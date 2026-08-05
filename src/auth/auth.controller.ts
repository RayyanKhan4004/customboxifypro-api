import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CurrentAdmin, Public, ReqIp } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { AuthService, AdminSessionResponse, LoginMeta } from './auth.service';
import { AdminRepository } from '../admins/repositories/admin.repository';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@ApiTags('admin-auth')
@ApiCookieAuth()
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly admins: AdminRepository,
  ) {}

  @Post('login')
  @Public()
  async login(
    @Body() dto: LoginDto,
    @ReqIp() ip: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSessionResponse> {
    const meta: LoginMeta = {
      ip,
      userAgent: req.headers['user-agent'],
      device: req.headers['sec-ch-ua-platform'] as string | undefined,
    };
    return this.authService.login(dto, meta, res);
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSessionResponse> {
    return this.authService.refresh(req, res);
  }

  @Post('logout')
  @Public()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(req, res);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  async logoutAll(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(admin, req, res);
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @Public()
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.resetPassword(dto, res);
  }

  @Post('change-password')
  @ApiBearerAuth()
  async changePassword(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.changePassword(admin, dto, req);
  }

  @Get('me')
  @ApiBearerAuth()
  async me(
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const record = await this.admins.findByIdLean(admin.id);
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      roleId: admin.roleId,
      roleKey: admin.roleKey,
      permissions: admin.permissions,
      twoFactorEnabled: record?.twoFactorEnabled ?? false,
      lastLoginAt: record?.lastLoginAt ?? null,
      createdAt: record?.createdAt ?? null,
    };
  }

  @Get('sessions')
  @ApiBearerAuth()
  sessions(
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<Array<Record<string, unknown>>> {
    return this.authService.listSessions(admin);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  async revokeSession(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') sessionId: string,
  ): Promise<void> {
    await this.authService.revokeSession(admin, sessionId);
  }
}
