import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Admin, AdminDocument } from '../admins/schemas/admin.schema';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { ApiException } from '../common/exceptions/api.exception';
import { ErrorCodes } from '../common/constants/error-codes';
import { AppLogger } from '../common/logger/logger.service';
import { Role } from './schemas/role.schema';
import { RoleRepository } from './repositories/role.repository';
import {
  CreateRoleDto,
  UpdateRoleDto,
  assertPermissionsAreValid,
} from './dto/role.dto';

const SYSTEM_ROLE_KEYS = ['super-admin'];

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RoleRepository,
    private readonly cacheInvalidator: CacheInvalidationService,
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    private readonly logger: AppLogger,
  ) {}

  async list(): Promise<Array<Record<string, unknown>>> {
    const roles = (await this.repository.findAllActive()) as unknown as Array<
      Role & { _id: unknown }
    >;
    const adminCounts = await this.adminModel
      .aggregate<{ _id: unknown; count: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$roleId', count: { $sum: 1 } } },
      ])
      .exec();

    const counts = new Map(
      adminCounts.map((entry) => [String(entry._id), entry.count]),
    );
    return roles.map((role) => ({
      id: String(role._id),
      name: role.name,
      key: role.key,
      description: role.description,
      permissions: role.permissions,
      isSystem: role.isSystem,
      status: role.status,
      adminCount: counts.get(String(role._id)) ?? 0,
      createdAt: (role as unknown as { createdAt: Date }).createdAt,
      updatedAt: (role as unknown as { updatedAt: Date }).updatedAt,
    }));
  }

  async create(dto: CreateRoleDto): Promise<Record<string, unknown>> {
    assertPermissionsAreValid(dto.permissions);
    if (await this.repository.countByKey(dto.key)) {
      throw ApiException.conflict(
        ErrorCodes.ROLE_NOT_FOUND,
        'A role with this key already exists.',
      );
    }
    const created = await this.repository.create(dto);
    await this.invalidateRbac();
    this.logger.info('role created', {
      roleId: String(created._id),
      key: created.key,
    });
    return { id: String(created._id), key: created.key };
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(ErrorCodes.ROLE_NOT_FOUND, 'Role not found.');
    }
    if (dto.permissions) {
      assertPermissionsAreValid(dto.permissions);
      if (
        SYSTEM_ROLE_KEYS.includes(existing.key) &&
        dto.permissions.length === 0
      ) {
        throw ApiException.forbidden(
          'System roles cannot be emptied of permissions.',
        );
      }
    }
    const updated = await this.repository.update(id, dto);
    await this.invalidateRbac();
    this.logger.info('role updated', { roleId: id });
    return { id, key: updated?.key };
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiException.notFound(ErrorCodes.ROLE_NOT_FOUND, 'Role not found.');
    }
    if (existing.isSystem || SYSTEM_ROLE_KEYS.includes(existing.key)) {
      throw ApiException.forbidden('System roles cannot be deleted.');
    }
    const adminCount = await this.adminModel.countDocuments({
      roleId: id,
      deletedAt: null,
    });
    if (adminCount > 0) {
      throw ApiException.conflict(
        ErrorCodes.ROLE_IN_USE,
        `Role is assigned to ${adminCount} admin(s) and cannot be deleted.`,
      );
    }
    await this.repository.delete(id);
    await this.invalidateRbac();
    this.logger.info('role deleted', { roleId: id });
  }

  private async invalidateRbac(): Promise<void> {
    await this.cacheInvalidator.invalidateRbac();
  }
}
