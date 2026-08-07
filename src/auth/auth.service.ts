import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { hash, verify } from '@node-rs/argon2';

import { AdminRepository } from '../admins/repositories/admin.repository';
import { AdminDocument } from '../admins/schemas/admin.schema';
import { RoleRepository } from '../roles/repositories/role.repository';
import { Role } from '../roles/schemas/role.schema';
import { SessionRepository } from './repositories/session.repository';
import { TokenService } from './token.service';
import { CookieService } from './cookie.service';
import { CacheService } from '../cache/cache.service';
import { AuthConfig } from '../config/auth.config';
import { AppConfig } from '../config/app.config';
import { AppLogger } from '../common/logger/logger.service';
import { ApiException } from '../common/exceptions/api.exception';
import { ErrorCodes } from '../common/constants/error-codes';
import { sha256 } from '../common/utils/strings';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { NotificationService } from '../jobs/notifications/notification.service';
import { PasswordService } from '../common/security/password.service';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { ChangePasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';

export interface LoginMeta {
  ip?: string;
  userAgent?: string;
  device?: string;
}

export interface AdminSessionResponse {
  admin: {
    id: string;
    email: string;
    name: string;
    roleId: string;
    roleKey: string;
    permissions: string[];
    twoFactorEnabled: boolean;
  };
  accessTokenExpiresIn: string;
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private dummyHashPromise: Promise<string> | null = null;

  constructor(
    private readonly admins: AdminRepository,
    private readonly roles: RoleRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly cookies: CookieService,
    private readonly cache: CacheService,
    private readonly authConfig: AuthConfig,
    private readonly appConfig: AppConfig,
    private readonly password: PasswordService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
  ) {}

  async login(
    dto: LoginDto,
    meta: LoginMeta,
    res: Response,
  ): Promise<AdminSessionResponse> {
    await this.enforceRateLimit(dto.email, meta.ip);

    const admin = await this.admins.findByEmail(dto.email);
    if (admin && this.isLocked(admin)) {
      throw new ApiException(
        ErrorCodes.AUTH_ACCOUNT_LOCKED,
        'The account is temporarily locked due to too many failed attempts.',
        HttpStatus.LOCKED,
      );
    }

    const validPassword =
      admin !== null
        ? await this.password.verify(admin.passwordHash, dto.password)
        : await this.verifyDummy();

    if (!admin || !validPassword) {
      await this.handleFailedLogin(admin, meta);
      throw new ApiException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'The email or password is incorrect.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (admin.status !== 'active') {
      throw new ApiException(
        ErrorCodes.AUTH_INACTIVE_ACCOUNT,
        'This account is not active.',
        HttpStatus.FORBIDDEN,
      );
    }

    admin.failedLoginAttempts = 0;
    admin.lockoutUntil = null;
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = meta.ip ?? null;
    await admin.save();

    const role = await this.loadRole(admin);
    const principal = this.buildPrincipal(admin, role);
    const { sessionId, refreshToken } = await this.createSession(
      String(admin._id),
      meta,
    );
    const accessToken = this.tokens.signAccessToken(principal, sessionId);

    this.cookies.setAccessCookie(res, accessToken);
    this.cookies.setRefreshCookie(res, refreshToken);

    await this.audit.log({
      actorId: String(admin._id),
      action: AuditActions.ADMIN_LOGIN,
      resourceType: 'auth',
      resourceId: sessionId,
      after: { ip: meta.ip, device: meta.device },
    });

    this.logger.info('admin logged in', {
      adminId: String(admin._id),
      sessionId,
    });
    return this.toSessionResponse(principal);
  }

  async refresh(req: Request, res: Response): Promise<AdminSessionResponse> {
    const refreshToken = this.extractRefreshToken(req);
    if (!refreshToken) {
      throw new ApiException(
        ErrorCodes.AUTH_REFRESH_REQUIRED,
        'A refresh token is required.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findByTokenHash(hash);

    if (!session) {
      const reuse = await this.sessions.findReuseByPrevHash(hash);
      if (reuse) {
        await this.revokeFamily(reuse.familyId, 'refresh-reuse');
        throw new ApiException(
          ErrorCodes.AUTH_TOKEN_REUSE_DETECTED,
          'The refresh token was reused. All sessions for this account were revoked.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new ApiException(
        ErrorCodes.AUTH_INVALID_TOKEN,
        'The refresh token is invalid.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new ApiException(
        ErrorCodes.AUTH_SESSION_REVOKED,
        'The session has expired or was revoked.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const admin = await this.admins.findActiveById(String(session.adminId));
    if (!admin) {
      throw new ApiException(
        ErrorCodes.AUTH_INACTIVE_ACCOUNT,
        'The account is not active.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const rotation = this.tokens.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.authConfig.refreshExpiresMs);
    const sessionId = String(session._id);
    await this.sessions.rotate(session, rotation.hash, expiresAt);
    await this.cache.setSessionMarker(
      sessionId,
      this.authConfig.refreshExpiresMs,
    );

    const role = await this.loadRole(admin);
    const principal = this.buildPrincipal(admin, role);
    const accessToken = this.tokens.signAccessToken(principal, sessionId);

    this.cookies.setAccessCookie(res, accessToken);
    this.cookies.setRefreshCookie(res, rotation.token);

    await this.audit.log({
      actorId: String(admin._id),
      action: AuditActions.ADMIN_REFRESH,
      resourceType: 'auth',
      resourceId: sessionId,
    });

    return this.toSessionResponse(principal);
  }

  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = this.extractRefreshToken(req);
    this.cookies.clearAuthCookies(res);
    if (!refreshToken) return;

    const hash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findByTokenHash(hash);
    if (!session) return;

    await this.sessions.revoke(String(session._id));
    await this.cache.revokeSessionMarker(String(session._id));
    await this.audit.log({
      actorId: String(session.adminId),
      action: AuditActions.ADMIN_LOGOUT,
      resourceType: 'auth',
      resourceId: String(session._id),
    });
  }

  async logoutAll(
    admin: AdminPrincipal,
    req: Request,
    res: Response,
  ): Promise<void> {
    this.cookies.clearAuthCookies(res);
    const sessions = await this.sessions.findActiveByAdmin(admin.id);
    await Promise.all(
      sessions.map((s) => this.cache.revokeSessionMarker(String(s._id))),
    );
    await this.sessions.revokeAllForAdmin(admin.id);
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.ADMIN_LOGOUT,
      resourceType: 'auth',
      after: { all: true },
    });
  }

  async listSessions(
    admin: AdminPrincipal,
  ): Promise<Array<Record<string, unknown>>> {
    const sessions = await this.sessions.findActiveByAdmin(admin.id);
    return sessions.map((session) => ({
      id: String(session._id),
      current: String(session._id) === admin.sessionId,
      device: session.device,
      ip: session.ip,
      userAgent: session.userAgent,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));
  }

  async revokeSession(admin: AdminPrincipal, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session || String(session.adminId) !== admin.id) {
      throw ApiException.notFound(
        ErrorCodes.AUTH_SESSION_REVOKED,
        'Session not found.',
      );
    }
    await this.sessions.revoke(sessionId);
    await this.cache.revokeSessionMarker(sessionId);
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.ADMIN_SESSION_REVOKED,
      resourceType: 'auth',
      resourceId: sessionId,
    });
  }

  async changePassword(
    admin: AdminPrincipal,
    dto: ChangePasswordDto,
    req: Request,
  ): Promise<void> {
    const record = await this.admins.findByIdWithSecrets(admin.id);
    if (!record) throw ApiException.unauthorized();

    const currentValid = await this.password.verify(
      record.passwordHash,
      dto.currentPassword,
    );
    if (!currentValid) {
      throw new ApiException(
        ErrorCodes.AUTH_PASSWORD_MISMATCH,
        'The current password is incorrect.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.ensurePasswordIsNew(
      record.passwordHash,
      dto.newPassword,
      record.previousPasswordHashes,
    );

    const newHash = await this.password.hash(dto.newPassword);
    record.previousPasswordHashes = [
      ...record.previousPasswordHashes,
      record.passwordHash,
    ].slice(-5);
    record.passwordHash = newHash;
    record.passwordChangedAt = new Date();
    await record.save();

    await this.sessions.revokeAllForAdmin(admin.id, admin.sessionId);
    const remaining = await this.sessions.findActiveByAdmin(admin.id);
    await Promise.all(
      remaining.map((s) => this.cache.revokeSessionMarker(String(s._id))),
    );

    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.ADMIN_PASSWORD_CHANGED,
      resourceType: 'auth',
      after: { ip: req.ip },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const admin = await this.admins.findByEmail(email);
    if (!admin) return;

    const { token, hash } = this.generateResetToken();
    admin.passwordResetTokenHash = hash;
    admin.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await admin.save();

    const resetUrl = `${this.appConfig.cors.adminUrl}/reset-password?token=${token}`;
    await this.notifications.sendEmail({
      to: admin.email,
      subject: 'Reset your Boxify admin password',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes.</p>`,
      text: `Reset your password: ${resetUrl}`,
    });

    await this.audit.log({
      actorId: String(admin._id),
      action: AuditActions.ADMIN_PASSWORD_RESET_REQUESTED,
      resourceType: 'auth',
    });
  }

  async resetPassword(dto: ResetPasswordDto, res: Response): Promise<void> {
    const hash = sha256(dto.token);
    const admin = await this.admins.findByPasswordResetTokenHash(hash);
    if (!admin) {
      throw new ApiException(
        ErrorCodes.AUTH_RESET_TOKEN_INVALID,
        'The reset token is invalid.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (
      !admin.passwordResetExpiresAt ||
      admin.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new ApiException(
        ErrorCodes.AUTH_RESET_TOKEN_EXPIRED,
        'The reset token has expired.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const newHash = await this.password.hash(dto.newPassword);
    admin.passwordHash = newHash;
    admin.passwordResetTokenHash = null;
    admin.passwordResetExpiresAt = null;
    admin.failedLoginAttempts = 0;
    admin.lockoutUntil = null;
    admin.passwordChangedAt = new Date();
    await admin.save();

    const sessions = await this.sessions.findActiveByAdmin(String(admin._id));
    await Promise.all(
      sessions.map((s) => this.cache.revokeSessionMarker(String(s._id))),
    );
    await this.sessions.revokeAllForAdmin(String(admin._id));
    this.cookies.clearAuthCookies(res);

    await this.audit.log({
      actorId: String(admin._id),
      action: AuditActions.ADMIN_PASSWORD_RESET,
      resourceType: 'auth',
    });
  }

  private async ensurePasswordIsNew(
    currentHash: string,
    newPassword: string,
    previousHashes: string[] = [],
  ): Promise<void> {
    if (await this.password.verify(currentHash, newPassword)) {
      throw new ApiException(
        ErrorCodes.AUTH_PASSWORD_REUSED,
        'New password must be different from the current password.',
        HttpStatus.BAD_REQUEST,
      );
    }
    for (const hash of previousHashes) {
      if (hash && (await this.password.verify(hash, newPassword))) {
        throw new ApiException(
          ErrorCodes.AUTH_PASSWORD_REUSED,
          'You cannot reuse one of your previous passwords.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private async createSession(
    adminId: string,
    meta: LoginMeta,
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const familyId = randomUUID();
    const { token, hash } = this.tokens.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.authConfig.refreshExpiresMs);
    const session = await this.sessions.create({
      adminId,
      familyId,
      tokenHash: hash,
      expiresAt,
      device: meta.device,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await this.cache.setSessionMarker(
      String(session._id),
      this.authConfig.refreshExpiresMs,
    );
    return { sessionId: String(session._id), refreshToken: token };
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    const sessionIds = await this.sessions.listFamilySessionIds(familyId);
    await Promise.all(
      sessionIds.map((id) => this.cache.revokeSessionMarker(id)),
    );
    await this.sessions.revokeFamily(familyId);
    this.logger.warn('refresh token reuse detected', { familyId, reason });
  }

  private async handleFailedLogin(
    admin: AdminDocument | null,
    meta: LoginMeta,
  ): Promise<void> {
    if (!admin) return;
    admin.failedLoginAttempts += 1;
    if (admin.failedLoginAttempts >= this.authConfig.loginMaxAttempts) {
      admin.lockoutUntil = new Date(Date.now() + this.authConfig.lockoutMs);
      admin.failedLoginAttempts = 0;
    }
    await admin.save();
    await this.audit.log({
      actorId: String(admin._id),
      action: AuditActions.ADMIN_LOGIN_FAILED,
      resourceType: 'auth',
      after: { ip: meta.ip },
    });
  }

  private async enforceRateLimit(email: string, ip?: string): Promise<void> {
    const emailKey = sha256(email.toLowerCase());
    const key = ip ? `auth:login:${emailKey}:${ip}` : `auth:login:${emailKey}`;
    const count = await this.cache.incrementCounter(
      key,
      this.authConfig.rateLimitTtlMs,
    );
    if (count > this.authConfig.rateLimitMax) {
      throw new ApiException(
        ErrorCodes.RATE_LIMITED,
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private isLocked(admin: { lockoutUntil: Date | null }): boolean {
    return Boolean(
      admin.lockoutUntil && admin.lockoutUntil.getTime() > Date.now(),
    );
  }

  private async verifyDummy(): Promise<boolean> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = hash('timing-equalization-dummy');
    }
    const h = await this.dummyHashPromise;
    return verify(h, 'definitely-wrong-password');
  }

  private extractRefreshToken(req: Request): string | null {
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
      this.authConfig.cookies.refreshName
    ];
    if (fromCookie) return fromCookie;
    const body = req.body as { refreshToken?: string } | undefined;
    return body?.refreshToken ?? null;
  }

  private generateResetToken(): { token: string; hash: string } {
    const token = this.tokens.generateRefreshToken();
    return { token: token.token, hash: sha256(token.token) };
  }

  private async loadRole(
    admin: Pick<AdminDocument, 'roleId'>,
  ): Promise<Role | null> {
    const role = await this.roles.findById(String(admin.roleId));
    return role as Role | null;
  }

  private buildPrincipal(
    admin: Pick<AdminDocument, '_id' | 'email' | 'name' | 'roleId'>,
    role: Role | null,
  ): Pick<
    AdminPrincipal,
    'id' | 'email' | 'name' | 'roleId' | 'roleKey' | 'permissions'
  > {
    return {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      roleId: String(admin.roleId),
      roleKey: role?.key ?? 'unknown',
      permissions: role?.permissions ?? [],
    };
  }

  private toSessionResponse(
    principal: Pick<
      AdminPrincipal,
      'id' | 'email' | 'name' | 'roleId' | 'roleKey' | 'permissions'
    >,
  ): AdminSessionResponse {
    return {
      admin: {
        id: principal.id,
        email: principal.email,
        name: principal.name,
        roleId: principal.roleId,
        roleKey: principal.roleKey,
        permissions: principal.permissions,
        twoFactorEnabled: false,
      },
      accessTokenExpiresIn: this.authConfig.accessExpiresIn,
    };
  }
}
