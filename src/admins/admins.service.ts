import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AdminDocument, Admin } from './schemas/admin.schema';
import { AdminRepository } from './repositories/admin.repository';
import { RoleRepository } from '../roles/repositories/role.repository';
import { PasswordService } from '../common/security/password.service';
import { ApiException } from '../common/exceptions/api.exception';
import { ErrorCodes } from '../common/constants/error-codes';
import { AppLogger } from '../common/logger/logger.service';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { NotificationService } from '../jobs/notifications/notification.service';
import { AppConfig } from '../config/app.config';
import { adminPageData } from '../common/dto/pagination.types';
import {
  CreateAdminDto,
  InviteAdminDto,
  ListAdminsQuery,
  UpdateAdminDto,
} from './dto/admin.dto';
import { sha256, generateToken } from '../common/utils/strings';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminsService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly roles: RoleRepository,
    private readonly password: PasswordService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly appConfig: AppConfig,
    private readonly logger: AppLogger,
    @InjectModel(Admin.name) private readonly model: Model<AdminDocument>,
  ) {}

  async list(query: ListAdminsQuery) {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.search) {
      const pattern = this.escapeRegex(query.search);
      filter.$or = [
        { email: { $regex: pattern, $options: 'i' } },
        { name: { $regex: pattern, $options: 'i' } },
      ];
    }
    if (query.status) filter.status = query.status;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.model
        .aggregate<Record<string, unknown>>([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: query.limit },
          {
            $lookup: {
              from: 'roles',
              localField: 'roleId',
              foreignField: '_id',
              as: 'role',
            },
          },
          { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              id: { $toString: '$_id' },
              email: 1,
              name: 1,
              status: 1,
              roleId: { $toString: '$roleId' },
              roleKey: { $ifNull: ['$role.key', null] },
              roleName: { $ifNull: ['$role.name', null] },
              lastLoginAt: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ])
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return adminPageData(items, {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    });
  }

  async get(id: string): Promise<Record<string, unknown>> {
    const admin = await this.repository.findByIdLean(id);
    if (!admin) {
      throw ApiException.notFound(
        ErrorCodes.ADMIN_NOT_FOUND,
        'Admin not found.',
      );
    }
    const role = await this.roles.findById(String(admin.roleId));
    return {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      status: admin.status,
      roleId: String(admin.roleId),
      roleKey: role?.key ?? null,
      roleName: role?.name ?? null,
      twoFactorEnabled: admin.twoFactorEnabled,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  async create(
    dto: CreateAdminDto,
    actor: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    await this.assertEmailAndRole(dto.email, dto.roleId);
    const passwordHash = await this.password.hash(dto.password);
    const admin = await this.repository.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      roleId: new Types.ObjectId(dto.roleId),
      passwordHash,
      status: 'active',
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditActions.ADMIN_CREATED,
      resourceType: 'admin',
      resourceId: String(admin._id),
    });
    this.logger.info('admin created', {
      adminId: String(admin._id),
      by: actor.id,
    });
    return this.get(String(admin._id));
  }

  async invite(
    dto: InviteAdminDto,
    actor: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    await this.assertEmailAndRole(dto.email, dto.roleId);

    const token = generateToken(40);
    const admin = await this.repository.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      roleId: new Types.ObjectId(dto.roleId),
      passwordHash: await this.password.hash(generateToken(32)),
      status: 'invited',
      invitationTokenHash: sha256(token),
      invitationExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    const inviteUrl = `${this.appConfig.cors.adminUrl}/set-password?token=${token}`;
    try {
      await this.notifications.sendEmail({
        to: admin.email,
        subject: 'You have been invited to the Boxify admin panel',
        html: `<p>Set your password here: <a href="${inviteUrl}">${inviteUrl}</a>. This invitation expires in 7 days.</p>`,
        text: `Set your password: ${inviteUrl}`,
      });
    } catch (error) {
      await this.repository.softDelete(String(admin._id), actor.id);
      this.logger.error('admin invitation could not be queued', {
        adminId: String(admin._id),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiException.invalid(
        ErrorCodes.ADMIN_INVITE_INVALID,
        'The invitation could not be queued. Please try again.',
      );
    }

    await this.audit.log({
      actorId: actor.id,
      action: AuditActions.ADMIN_INVITED,
      resourceType: 'admin',
      resourceId: String(admin._id),
    });
    this.logger.info('admin invited', {
      adminId: String(admin._id),
      by: actor.id,
    });

    const result = await this.get(String(admin._id));
    return {
      ...result,
      inviteUrl:
        this.appConfig.nodeEnv !== 'production' ? inviteUrl : undefined,
    };
  }

  async update(
    id: string,
    dto: UpdateAdminDto,
    actor: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.ADMIN_NOT_FOUND,
        'Admin not found.',
      );
    }
    if (dto.roleId) {
      const role = await this.roles.findById(dto.roleId);
      if (!role)
        throw ApiException.notFound(
          ErrorCodes.ROLE_NOT_FOUND,
          'Role not found.',
        );
    }

    await this.repository.update(id, {
      ...dto,
      roleId: dto.roleId ? new Types.ObjectId(dto.roleId) : undefined,
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditActions.ADMIN_UPDATED,
      resourceType: 'admin',
      resourceId: id,
      before: { status: existing.status, roleId: String(existing.roleId) },
      after: dto,
    });
    return this.get(id);
  }

  async remove(id: string, actor: AdminPrincipal): Promise<void> {
    if (id === actor.id) {
      throw ApiException.forbidden('You cannot delete your own account.');
    }
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(
        ErrorCodes.ADMIN_NOT_FOUND,
        'Admin not found.',
      );
    }
    const role = await this.roles.findById(String(existing.roleId));
    if (role?.key === 'super-admin') {
      throw ApiException.forbidden(
        'The super admin account cannot be deleted.',
      );
    }

    await this.repository.softDelete(id, actor.id);
    await this.audit.log({
      actorId: actor.id,
      action: AuditActions.ADMIN_DELETED,
      resourceType: 'admin',
      resourceId: id,
    });
  }

  private async assertEmailAndRole(
    email: string,
    roleId: string,
  ): Promise<void> {
    if (await this.repository.countByEmail(email)) {
      throw ApiException.conflict(
        ErrorCodes.ADMIN_EXISTS,
        'An admin with this email already exists.',
      );
    }
    const role = await this.roles.findById(roleId);
    if (!role)
      throw ApiException.notFound(ErrorCodes.ROLE_NOT_FOUND, 'Role not found.');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
