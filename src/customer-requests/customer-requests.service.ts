import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

import { AuditService } from '../audit-logs/audit.service';
import { AuditActions } from '../audit-logs/audit-actions';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AdminPagedData, adminPageData } from '../common/dto/pagination.types';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { sha256 } from '../common/utils/strings';
import { MediaService } from '../media/media.service';
import { ChatsService } from '../chats/chats.service';
import { NotificationService } from '../jobs/notifications/notification.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
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
    private readonly mediaService: MediaService,
    private readonly chats: ChatsService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly inAppNotifications: InAppNotificationsService,
  ) {}

  async submit(
    dto: SubmitCustomerRequestDto,
    ip: string | undefined,
    attachmentFile?: Express.Multer.File,
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
    if (
      dto.whatsappOptIn &&
      !/^\+[1-9]\d{7,14}$/.test(dto.contact.phone?.trim() ?? '')
    ) {
      throw ApiException.validation([
        {
          field: 'contact.phone',
          message:
            'An E.164 phone number is required for WhatsApp confirmation.',
        },
      ]);
    }

    const existing = await this.repository.findByIdempotencyKey(
      dto.idempotencyKey,
    );
    if (existing) {
      return this.finalizeSubmission(existing);
    }

    const attachments = [...(dto.attachments ?? [])];
    if (attachmentFile) {
      const uploaded =
        await this.mediaService.uploadRequestAttachment(attachmentFile);
      attachments.push(String(uploaded.key));
    }
    await this.mediaService.assertReadyRequestAttachments(attachments);

    let created: CustomerRequestDocument;
    try {
      created = await this.repository.create({
        requestType: dto.requestType as CustomerRequestType,
        customRequestType: dto.customRequestType ?? null,
        contact: {
          ...dto.contact,
          name: dto.contact.name.trim(),
          email: dto.contact.email.trim().toLowerCase(),
          phone: dto.contact.phone?.trim(),
        },
        productName: dto.productName ?? null,
        quantity: dto.quantity ?? null,
        specs: dto.specs ?? {},
        notes: dto.notes ?? null,
        attachments,
        consent: dto.consent,
        whatsappOptIn: dto.whatsappOptIn === true,
        idempotencyKey: dto.idempotencyKey,
        sourceIpHash: ip ? sha256(ip) : null,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const repeated = await this.repository.findByIdempotencyKey(
          dto.idempotencyKey,
        );
        if (repeated) return this.finalizeSubmission(repeated);
      }
      throw error;
    }

    await this.audit.log({
      actorType: 'system',
      action: AuditActions.REQUEST_SUBMITTED,
      resourceType: 'customer-request',
      resourceId: String(created._id),
    });
    return this.finalizeSubmission(created);
  }

  private async finalizeSubmission(
    created: CustomerRequestDocument,
  ): Promise<Record<string, unknown>> {
    const id = String(created._id);
    const quoteNumber =
      created.quoteNumber ?? `CB-${id.slice(-8).toUpperCase()}`;
    const linked = await this.chats.linkQuote(
      created._id,
      created.contact,
      created.whatsappOptIn,
    );
    await this.repository.update(id, {
      quoteNumber,
      customerId: linked.customerId,
      conversationId: linked.conversationId,
      conversationSkipReason: linked.conversationSkipReason,
    });
    await this.inAppNotifications.create(
      `quote:${id}`,
      'quote',
      `New quote request ${quoteNumber}`,
      `/requests?requestId=${id}`,
    );
    if (
      created.whatsappOptIn &&
      (linked.conversationId ||
        linked.conversationSkipReason === 'phone_linked_to_different_customer')
    ) {
      await this.chats.queueQuoteConfirmation(
        linked.conversationId,
        created._id,
        created.contact.name,
        quoteNumber,
        created.contact.phone,
      );
    }

    if (
      this.config.get('EMAIL_ENABLED') === true ||
      this.config.get<string>('EMAIL_ENABLED') === 'true'
    ) {
      const name = this.escapeHtml(created.contact.name);
      const number = this.escapeHtml(quoteNumber);
      const product = this.escapeHtml(
        created.productName ?? created.requestType,
      );
      const quantity = created.quantity ? `, quantity ${created.quantity}` : '';
      const customerText = `Hi ${created.contact.name},\n\nThank you for requesting a quote from Custom Boxify Pro. Your quote request #${quoteNumber} for ${created.productName ?? created.requestType}${quantity} has been received. Our team will contact you shortly.`;
      await this.notifications.sendEmail({
        to: created.contact.email,
        subject: 'We Received Your Quote - Custom Boxify Pro',
        html: `<p>Hi ${name},</p><p>Thank you for requesting a quote from Custom Boxify Pro.</p><p>Your quote request <strong>#${number}</strong> for ${product}${quantity} has been received. Our team will contact you shortly.</p>`,
        text: customerText,
        idempotencyKey: `quote:${id}:customer-email`,
      });
      const recipients = (
        this.config.get<string>('EMAIL_ADMIN_RECIPIENTS') ?? ''
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const adminUrl = this.config.get<string>('ADMIN_APP_URL') ?? '';
      const phone = created.contact.phone ?? 'Not provided';
      for (const recipient of recipients) {
        await this.notifications.sendEmail({
          to: recipient,
          subject: `New Quote Request - ${quoteNumber}`,
          html: `<p>New quote request <strong>${number}</strong> from ${name} (${this.escapeHtml(created.contact.email)}).</p><p>Phone: ${this.escapeHtml(phone)}</p><p>Product: ${product}${quantity}</p><p><a href="${this.escapeHtml(adminUrl)}/requests?requestId=${id}">Open quote</a></p>`,
          text: `New quote request ${quoteNumber} from ${created.contact.name} (${created.contact.email}). Phone: ${phone}. Product: ${created.productName ?? created.requestType}${quantity}. Open ${adminUrl}/requests?requestId=${id}`,
          idempotencyKey: `quote:${id}:admin-email:${recipient}`,
        });
      }
    }
    return {
      id,
      status: created.status,
      quoteNumber,
      conversationId: linked.conversationId
        ? String(linked.conversationId)
        : null,
    };
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char] ?? char,
    );
  }

  async submitWithAttachment(
    dto: SubmitCustomerRequestDto,
    file: Express.Multer.File,
    ip: string | undefined,
  ): Promise<Record<string, unknown>> {
    return this.submit(dto, ip, file);
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
    const urls = await this.mediaService.resolveUrls(record.attachments ?? []);
    return {
      ...record,
      _id: record._id.toString(),
      attachmentUrls: Object.fromEntries(
        (record.attachments ?? []).map((key) => [key, urls[key]?.url ?? null]),
      ),
    };
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
