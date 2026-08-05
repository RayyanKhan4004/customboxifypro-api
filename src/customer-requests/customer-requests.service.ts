import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AdminPagedData, adminPageData } from '../common/dto/pagination.types';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { sha256 } from '../common/utils/strings';
import { CustomerRequestRepository } from './repositories/customer-request.repository';
import {
  CustomerRequestDocument,
  RequestStatus,
  RequestType as CustomerRequestType,
} from './schemas/customer-request.schema';
import { SpamGuardService } from './spam-guard.service';
import {
  AddNoteDto,
  AssignRequestDto,
  BulkStatusDto,
  ListRequestsQueryDto,
  SubmitCustomerRequestDto,
  UpdateRequestStatusDto,
} from './dto/customer-request.dto';

@Injectable()
export class CustomerRequestsService {
  constructor(
    private readonly repository: CustomerRequestRepository,
    private readonly spamGuard: SpamGuardService,
    private readonly audit: AuditService,
  ) {}

  async submit(
    dto: SubmitCustomerRequestDto,
    ip: string | undefined,
  ): Promise<Record<string, unknown>> {
    // Honeypot: bots fill the hidden field; drop silently without persisting.
    if (dto.website && dto.website.length > 0) {
      return { id: null, status: 'received' };
    }
    const verified = await this.spamGuard.verify(dto.gRecaptchaToken);
    if (!verified) {
      throw ApiException.invalid(
        ErrorCodes.REQUEST_DUPLICATE,
        'Captcha verification failed.',
        [{ field: 'gRecaptchaToken' }],
      );
    }

    const existing = await this.repository.findByIdempotencyKey(
      dto.idempotencyKey,
    );
    if (existing) {
      throw ApiException.conflict(
        ErrorCodes.REQUEST_DUPLICATE,
        'A request with this idempotency key already exists.',
      );
    }

    let created: CustomerRequestDocument;
    try {
      created = await this.repository.create({
        requestType: dto.requestType as CustomerRequestType,
        customRequestType: dto.customRequestType ?? null,
        contact: dto.contact,
        productName: dto.productName ?? null,
        quantity: dto.quantity ?? null,
        specs: dto.specs ?? {},
        notes: dto.notes ?? null,
        attachments: dto.attachments ?? [],
        consent: dto.consent,
        idempotencyKey: dto.idempotencyKey,
        sourceIpHash: ip ? sha256(ip) : null,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw ApiException.conflict(
          ErrorCodes.REQUEST_DUPLICATE,
          'A request with this idempotency key already exists.',
        );
      }
      throw error;
    }

    await this.audit.log({
      actorType: 'system',
      action: AuditActions.REQUEST_SUBMITTED,
      resourceType: 'customer-request',
      resourceId: String(created._id),
    });
    return { id: String(created._id), status: created.status };
  }

  async list(
    query: ListRequestsQueryDto,
  ): Promise<AdminPagedData<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.requestType) filter.requestType = query.requestType;
    if (query.assignedTo)
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.from || query.to) {
      const createdAt: Record<string, unknown> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      filter.createdAt = createdAt;
    }
    if (query.search) {
      const regex = { $regex: this.escapeRegex(query.search), $options: 'i' };
      filter.$or = [
        { 'contact.name': regex },
        { 'contact.email': regex },
        { 'contact.company': regex },
        { productName: regex },
      ];
    }
    const sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (query.sort === 'createdAt') sort.createdAt = 1;
    if (query.sort === 'updatedAt') sort.updatedAt = 1;
    if (query.sort === '-updatedAt') sort.updatedAt = -1;

    const [items, total] = await Promise.all([
      this.repository.find(filter, sort, limit, (page - 1) * limit),
      this.repository.count(filter),
    ]);
    return adminPageData(
      items.map((item) => ({ ...item, _id: item._id.toString() })),
      { limit, page, total, totalPages: Math.ceil(total / limit) },
    );
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.REQUEST_NOT_FOUND,
        'Request not found.',
      );
    }
    return { ...record, _id: record._id.toString() };
  }

  async updateStatus(
    id: string,
    dto: UpdateRequestStatusDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.REQUEST_NOT_FOUND,
        'Request not found.',
      );
    }
    const data: Record<string, unknown> = {
      status: dto.status,
      updatedAt: new Date(),
    };
    if (!record.assignedTo && dto.status !== 'new') {
      data.assignedTo = new Types.ObjectId(admin.id);
      data.assignedAt = new Date();
    }
    await this.repository.update(id, data);
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.REQUEST_STATUS_CHANGED,
      resourceType: 'customer-request',
      resourceId: id,
      before: { status: record.status },
      after: { status: dto.status, note: dto.note },
    });
    return { id, status: dto.status };
  }

  async assign(
    id: string,
    dto: AssignRequestDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.REQUEST_NOT_FOUND,
        'Request not found.',
      );
    }
    await this.repository.update(id, {
      assignedTo: new Types.ObjectId(dto.assignedTo),
      assignedAt: new Date(),
    });
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.REQUEST_ASSIGNED,
      resourceType: 'customer-request',
      resourceId: id,
      after: { assignedTo: dto.assignedTo },
    });
    return { id, assignedTo: dto.assignedTo };
  }

  async addNote(
    id: string,
    dto: AddNoteDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiException.notFound(
        ErrorCodes.REQUEST_NOT_FOUND,
        'Request not found.',
      );
    }
    const staffNotes = [
      ...(record.staffNotes ?? []),
      { text: dto.note, adminId: admin.id, createdAt: new Date() },
    ];
    await this.repository.update(id, { staffNotes });
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.REQUEST_NOTE_ADDED,
      resourceType: 'customer-request',
      resourceId: id,
    });
    return { id, staffNotes };
  }

  async bulkStatus(
    dto: BulkStatusDto,
    admin: AdminPrincipal,
  ): Promise<Record<string, unknown>> {
    const ids = dto.ids.map((id) => new Types.ObjectId(id));
    const result = await this.repository.updateMany(
      { _id: { $in: ids }, deletedAt: null },
      { status: dto.status as RequestStatus, updatedAt: new Date() },
    );
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.REQUEST_BULK_STATUS_CHANGED,
      resourceType: 'customer-request',
      resourceId: dto.ids.join(','),
      after: { status: dto.status, count: result },
    });
    return { updated: result };
  }

  async exportCsv(query: ListRequestsQueryDto): Promise<string> {
    const page = 1;
    const limit = Math.min(query.limit ?? 500, 1000);
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.requestType) filter.requestType = query.requestType;
    const items = await this.repository.find(
      filter,
      { createdAt: -1 },
      limit,
      (page - 1) * limit,
    );
    const rows = items.map((item) => ({
      id: item._id.toString(),
      createdAt: item.createdAt.toISOString(),
      requestType: item.requestType,
      status: item.status,
      name: item.contact.name,
      email: item.contact.email,
      phone: item.contact.phone ?? '',
      company: item.contact.company ?? '',
      productName: item.productName ?? '',
      quantity: item.quantity ?? '',
      notes: item.notes ?? '',
    }));
    if (rows.length === 0) {
      return 'id,createdAt,requestType,status,name,email,phone,company,productName,quantity,notes\n';
    }
    const header = Object.keys(rows[0]).join(',');
    const lines = rows.map((row) =>
      Object.values(row)
        .map((value) => this.csvEscape(String(value)))
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  private csvEscape(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
