import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RequestContextService } from '../common/logger/request-context.service';
import {
  AuditLog,
  AuditLogDocument,
  AuditActorType,
} from './schemas/audit-log.schema';

export interface AuditEntry {
  actorId?: string;
  actorType?: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>,
    private readonly context: RequestContextService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    const request = this.context.current();
    await this.model.create({
      actorId: entry.actorId ? new Types.ObjectId(entry.actorId) : null,
      actorType: entry.actorType ?? (entry.actorId ? 'admin' : 'system'),
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: request?.ip ?? null,
      requestId: request?.requestId ?? null,
    });
  }

  async list(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: AuditLogDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
