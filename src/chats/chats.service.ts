import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';

import { AuditService } from '../audit-logs/audit.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import {
  CustomerRequest,
  CustomerRequestDocument,
} from '../customer-requests/schemas/customer-request.schema';
import { WhatsAppConfig } from '../config/whatsapp.config';
import { NotificationService } from '../jobs/notifications/notification.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Admin, AdminDocument } from '../admins/schemas/admin.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { AuditActions } from '../audit-logs/audit-actions';
import {
  MessageStatusEvent,
  MessageStatusEventDocument,
} from './schemas/message-status.schema';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/message.schema';
import {
  ListChatsDto,
  ListMessagesDto,
  SendMessageDto,
  SendTemplateDto,
} from './dto/chats.dto';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? (value as unknown[])
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function providerTimestamp(value: unknown): Date {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? new Date(Number(value) * 1000)
    : new Date();
}

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customers: Model<CustomerDocument>,
    @InjectModel(Conversation.name)
    private readonly conversations: Model<ConversationDocument>,
    @InjectModel(ChatMessage.name)
    private readonly messages: Model<ChatMessageDocument>,
    @InjectModel(CustomerRequest.name)
    private readonly requests: Model<CustomerRequestDocument>,
    private readonly audit: AuditService,
    private readonly whatsappConfig: WhatsAppConfig,
    private readonly notifications: NotificationService,
    private readonly inAppNotifications: InAppNotificationsService,
    private readonly whatsapp: WhatsAppService,
    @InjectModel(Admin.name) private readonly admins: Model<AdminDocument>,
    @InjectModel(Role.name) private readonly roles: Model<RoleDocument>,
    @InjectModel(MessageStatusEvent.name)
    private readonly statusEvents: Model<MessageStatusEventDocument>,
  ) {}

  async linkQuote(
    quoteId: Types.ObjectId,
    contact: { name: string; email: string; phone?: string },
    whatsappConsent: boolean,
  ): Promise<{
    customerId: Types.ObjectId;
    conversationId: Types.ObjectId | null;
    conversationSkipReason: string | null;
  }> {
    const email = contact.email.trim().toLowerCase();
    const phone = contact.phone?.trim() ?? null;
    const normalizedPhone =
      phone && /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
    const phoneNumberId = this.whatsappConfig.phoneNumberId;
    const waId = normalizedPhone?.slice(1) ?? null;
    const existingConversation =
      phoneNumberId && waId
        ? await this.conversations.findOne({ phoneNumberId, waId }).exec()
        : null;
    const existingContact = existingConversation
      ? await this.customers.findById(existingConversation.customerId).exec()
      : null;
    const contactFilter =
      existingContact && !existingContact.email
        ? { _id: existingContact._id }
        : { email };
    const customer = await this.customers
      .findOneAndUpdate(
        contactFilter,
        {
          $set: {
            name: contact.name.trim(),
            email,
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
            ...(whatsappConsent
              ? {
                  whatsappConsent: true,
                  consentAt: new Date(),
                  consentSource: 'quote-form',
                }
              : {}),
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    if (!customer) throw new Error('Customer could not be saved');
    if (
      !phoneNumberId ||
      !waId ||
      (existingContact?.email && existingContact.email !== email)
    )
      return {
        customerId: customer._id,
        conversationId: null,
        conversationSkipReason: !phoneNumberId
          ? 'sender_not_configured'
          : !waId
            ? 'phone_missing_or_invalid'
            : 'phone_linked_to_different_customer',
      };
    const conversation = await this.conversations
      .findOneAndUpdate(
        { phoneNumberId, waId },
        {
          $setOnInsert: { customerId: customer._id, status: 'open' },
          $addToSet: { quoteIds: quoteId },
        },
        { upsert: true, new: true },
      )
      .exec();
    return {
      customerId: customer._id,
      conversationId: conversation?._id ?? null,
      conversationSkipReason: conversation ? null : 'conversation_not_created',
    };
  }

  async queueQuoteConfirmation(
    conversationId: Types.ObjectId,
    quoteId: Types.ObjectId,
    name: string,
    quoteNumber: string,
  ): Promise<void> {
    if (
      !this.whatsappConfig.enabled ||
      !this.whatsappConfig.confirmationTemplate
    )
      return;
    const conversation = await this.conversations
      .findById(conversationId)
      .exec();
    if (!conversation) return;
    const text = `Hi ${name}, your Custom Boxify Pro quote request #${quoteNumber} has been received. Our team will contact you shortly.`;
    const templateStatus = this.whatsappConfig.quoteTemplateEnabled
      ? 'pending'
      : 'blocked';
    const idempotencyKey = `quote:${String(quoteId)}:whatsapp`;
    const message = await this.messages
      .findOneAndUpdate(
        { idempotencyKey },
        {
          $setOnInsert: {
            conversationId,
            idempotencyKey,
            direction: 'outbound',
            type: 'text',
            text,
            status: templateStatus === 'blocked' ? 'blocked' : 'queued',
            ...(templateStatus === 'blocked'
              ? {
                  failure:
                    'Quote template sending is disabled pending Meta approval',
                }
              : {}),
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    if (!message) throw new Error('Confirmation message could not be queued');
    await this.notifications.enqueue(
      'whatsapp',
      `+${conversation.waId}`,
      {
        type: 'template',
        template: this.whatsappConfig.confirmationTemplate,
        parameters: [name, quoteNumber],
        language: this.whatsappConfig.language,
        messageId: String(message._id),
      },
      idempotencyKey,
      templateStatus,
    );
  }

  private visibility(admin: AdminPrincipal): Record<string, unknown> {
    return admin.permissions.includes('chats.read_all')
      ? {}
      : { assignedTo: new Types.ObjectId(admin.id) };
  }

  async list(query: ListChatsDto, admin: AdminPrincipal) {
    const filter: Record<string, unknown> = { ...this.visibility(admin) };
    if (query.status) filter.status = query.status;
    if (query.assignedTo && admin.permissions.includes('chats.read_all')) {
      if (!isValidObjectId(query.assignedTo))
        throw ApiException.validation([{ field: 'assignedTo' }]);
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }
    if (query.search) {
      const regex = new RegExp(
        query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      const customers = await this.customers
        .find({ $or: [{ name: regex }, { phone: regex }] })
        .select('_id')
        .limit(200)
        .lean()
        .exec();
      filter.customerId = { $in: customers.map((customer) => customer._id) };
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.conversations
        .find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customerId', 'name email phone')
        .lean()
        .exec(),
      this.conversations.countDocuments(filter).exec(),
    ]);
    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getVisible(
    id: string,
    admin: AdminPrincipal,
  ): Promise<ConversationDocument> {
    if (!isValidObjectId(id))
      throw ApiException.notFound(
        ErrorCodes.NOT_FOUND,
        'Conversation not found.',
      );
    const conversation = await this.conversations
      .findOne({ _id: id, ...this.visibility(admin) })
      .exec();
    if (!conversation)
      throw ApiException.notFound(
        ErrorCodes.NOT_FOUND,
        'Conversation not found.',
      );
    return conversation;
  }

  async detail(id: string, admin: AdminPrincipal) {
    const conversation = await this.getVisible(id, admin);
    const customer = await this.customers
      .findById(conversation.customerId)
      .select('name email phone')
      .lean()
      .exec();
    return {
      _id: String(conversation._id),
      customerId: String(conversation.customerId),
      customer,
      waId: conversation.waId,
      assignedTo: conversation.assignedTo
        ? String(conversation.assignedTo)
        : null,
      status: conversation.status,
      lastInboundAt: conversation.lastInboundAt,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      unreadCount: conversation.unreadCount,
      quoteIds: conversation.quoteIds.map(String),
    };
  }

  async history(id: string, query: ListMessagesDto, admin: AdminPrincipal) {
    await this.getVisible(id, admin);
    const filter: Record<string, unknown> = {
      conversationId: new Types.ObjectId(id),
      direction: { $ne: 'note' },
    };
    if (query.before) {
      if (!isValidObjectId(query.before))
        throw ApiException.validation([{ field: 'before' }]);
      filter._id = { $lt: new Types.ObjectId(query.before) };
    }
    const limit = query.limit ?? 30;
    const items = await this.messages
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();
    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    return {
      data: page.reverse(),
      nextCursor: hasMore ? String(page[0]._id) : null,
    };
  }

  async notes(id: string, admin: AdminPrincipal) {
    await this.getVisible(id, admin);
    return this.messages
      .find({ conversationId: id, direction: 'note' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  templates() {
    return this.whatsappConfig.enabled &&
      this.whatsappConfig.quoteTemplateEnabled &&
      this.whatsappConfig.confirmationTemplate
      ? [
          {
            name: this.whatsappConfig.confirmationTemplate,
            language: this.whatsappConfig.language,
            configured: true,
          },
        ]
      : [];
  }

  async sendText(id: string, dto: SendMessageDto, admin: AdminPrincipal) {
    const conversation = await this.getVisible(id, admin);
    if (!this.whatsappConfig.enabled)
      throw ApiException.invalid(
        ErrorCodes.BAD_REQUEST,
        'WhatsApp messaging is disabled.',
      );
    if (
      !conversation.lastInboundAt ||
      Date.now() - conversation.lastInboundAt.getTime() >= 24 * 60 * 60 * 1000
    ) {
      throw ApiException.invalid(
        ErrorCodes.BAD_REQUEST,
        'The 24-hour customer service window has closed. Send an approved template instead.',
      );
    }
    const idempotencyKey = `chat:${id}:text:${dto.idempotencyKey}`;
    const message = await this.messages
      .findOneAndUpdate(
        { idempotencyKey },
        {
          $setOnInsert: {
            conversationId: conversation._id,
            idempotencyKey,
            direction: 'outbound',
            agentId: new Types.ObjectId(admin.id),
            type: 'text',
            text: dto.text,
            status: 'queued',
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    if (!message) throw new Error('Message could not be queued');
    await this.notifications.enqueue(
      'whatsapp',
      `+${conversation.waId}`,
      { type: 'text', text: dto.text, messageId: String(message._id) },
      idempotencyKey,
    );
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.CHAT_MESSAGE_QUEUED,
      resourceType: 'conversation',
      resourceId: id,
    });
    return message.toObject();
  }

  async sendTemplate(id: string, dto: SendTemplateDto, admin: AdminPrincipal) {
    const conversation = await this.getVisible(id, admin);
    if (
      !this.whatsappConfig.enabled ||
      !this.whatsappConfig.quoteTemplateEnabled ||
      !this.whatsappConfig.confirmationTemplate ||
      dto.name !== this.whatsappConfig.confirmationTemplate
    ) {
      throw ApiException.invalid(
        ErrorCodes.BAD_REQUEST,
        'This template is not configured.',
      );
    }
    const customer = await this.customers
      .findById(conversation.customerId)
      .exec();
    if (!customer?.whatsappConsent)
      throw ApiException.forbidden(
        'WhatsApp consent is not recorded for this customer.',
      );
    const latestQuoteId = conversation.quoteIds.at(-1);
    const quote = latestQuoteId
      ? await this.requests
          .findById(latestQuoteId)
          .select('quoteNumber')
          .lean()
          .exec()
      : null;
    if (!quote?.quoteNumber)
      throw ApiException.invalid(
        ErrorCodes.BAD_REQUEST,
        'This template requires a linked quote.',
      );
    const idempotencyKey = `chat:${id}:template:${dto.idempotencyKey}`;
    const message = await this.messages
      .findOneAndUpdate(
        { idempotencyKey },
        {
          $setOnInsert: {
            conversationId: conversation._id,
            idempotencyKey,
            direction: 'outbound',
            agentId: new Types.ObjectId(admin.id),
            type: 'text',
            text: `Template: ${dto.name}`,
            status: 'queued',
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    if (!message) throw new Error('Template message could not be queued');
    await this.notifications.enqueue(
      'whatsapp',
      `+${conversation.waId}`,
      {
        type: 'template',
        template: dto.name,
        parameters: [customer.name, quote.quoteNumber],
        messageId: String(message._id),
      },
      idempotencyKey,
    );
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.CHAT_TEMPLATE_QUEUED,
      resourceType: 'conversation',
      resourceId: id,
    });
    return message.toObject();
  }

  async addNote(id: string, text: string, admin: AdminPrincipal) {
    await this.getVisible(id, admin);
    const note = await this.messages.create({
      conversationId: new Types.ObjectId(id),
      direction: 'note',
      agentId: new Types.ObjectId(admin.id),
      text,
      status: 'received',
    });
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.CHAT_NOTE_ADDED,
      resourceType: 'conversation',
      resourceId: id,
    });
    return note;
  }

  async quotes(id: string, admin: AdminPrincipal) {
    const conversation = await this.getVisible(id, admin);
    return this.requests
      .find({ _id: { $in: conversation.quoteIds } })
      .select(
        'quoteNumber requestType productName quantity specs status createdAt contact',
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async assign(id: string, assignedTo: string, admin: AdminPrincipal) {
    if (!isValidObjectId(id) || !isValidObjectId(assignedTo))
      throw ApiException.validation([{ field: 'assignedTo' }]);
    const target = await this.admins
      .findOne({ _id: assignedTo, status: 'active', deletedAt: null })
      .select('roleId')
      .lean()
      .exec();
    const role = target
      ? await this.roles
          .findOne({ _id: target.roleId, status: 'active' })
          .select('permissions')
          .lean()
          .exec()
      : null;
    if (!role?.permissions.includes('chats.read'))
      throw ApiException.validation([
        {
          field: 'assignedTo',
          message: 'Assign an active admin who can read chats.',
        },
      ]);
    const updated = await this.conversations
      .findByIdAndUpdate(
        id,
        { $set: { assignedTo: new Types.ObjectId(assignedTo) } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated)
      throw ApiException.notFound(
        ErrorCodes.NOT_FOUND,
        'Conversation not found.',
      );
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.CHAT_ASSIGNED,
      resourceType: 'conversation',
      resourceId: id,
      after: { assignedTo },
    });
    return updated;
  }

  async setStatus(
    id: string,
    status: 'open' | 'resolved',
    admin: AdminPrincipal,
  ) {
    await this.getVisible(id, admin);
    const updated = await this.conversations
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .lean()
      .exec();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.CHAT_STATUS_CHANGED,
      resourceType: 'conversation',
      resourceId: id,
      after: { status },
    });
    return updated;
  }

  async markRead(id: string, admin: AdminPrincipal) {
    await this.getVisible(id, admin);
    await this.conversations
      .updateOne({ _id: id }, { $set: { unreadCount: 0 } })
      .exec();
    return { unreadCount: 0 };
  }

  async attachment(id: string, messageId: string, admin: AdminPrincipal) {
    await this.getVisible(id, admin);
    if (!isValidObjectId(messageId))
      throw ApiException.notFound(
        ErrorCodes.MEDIA_NOT_FOUND,
        'Attachment not found.',
      );
    const message = await this.messages
      .findOne({ _id: messageId, conversationId: id, direction: 'inbound' })
      .lean()
      .exec();
    const mediaId = message?.attachment?.providerMediaId;
    if (typeof mediaId !== 'string')
      throw ApiException.notFound(
        ErrorCodes.MEDIA_NOT_FOUND,
        'Attachment not found.',
      );
    return this.whatsapp.downloadMedia(mediaId);
  }

  async receiveWebhook(payload: unknown): Promise<void> {
    const root = asRecord(payload);
    for (const entry of asRecords(root?.entry).slice(0, 20)) {
      for (const change of asRecords(entry.changes).slice(0, 20)) {
        const value = asRecord(change.value);
        if (!value) continue;
        const phoneNumberId = asRecord(value.metadata)?.phone_number_id;
        if (
          typeof phoneNumberId !== 'string' ||
          phoneNumberId !== this.whatsappConfig.phoneNumberId
        )
          continue;
        for (const incoming of asRecords(value.messages).slice(0, 100)) {
          if (
            typeof incoming.id !== 'string' ||
            typeof incoming.from !== 'string'
          )
            continue;
          const waId = incoming.from;
          if (!/^\d{8,15}$/.test(waId)) continue;
          const phone = `+${waId}`;
          const matchingContact = asRecords(value.contacts).find(
            (contact) => contact.wa_id === waId,
          );
          const displayName = asRecord(matchingContact?.profile)?.name;
          const existingConversation = await this.conversations
            .findOne({ phoneNumberId, waId })
            .exec();
          const customer = existingConversation
            ? await this.customers
                .findById(existingConversation.customerId)
                .exec()
            : await this.customers
                .findOneAndUpdate(
                  { phone, email: null },
                  {
                    $setOnInsert: {
                      phone,
                      name:
                        typeof displayName === 'string'
                          ? displayName.slice(0, 120)
                          : phone,
                      whatsappConsent: false,
                    },
                  },
                  { upsert: true, new: true },
                )
                .exec();
          if (!customer) continue;
          const conversation = await this.conversations
            .findOneAndUpdate(
              { phoneNumberId, waId },
              { $setOnInsert: { customerId: customer._id, status: 'open' } },
              { upsert: true, new: true },
            )
            .exec();
          if (!conversation) continue;
          const type =
            typeof incoming.type === 'string' ? incoming.type : 'other';
          const media = type === 'text' ? null : asRecord(incoming[type]);
          const attachment = media
            ? {
                providerMediaId: typeof media.id === 'string' ? media.id : null,
                mimeType:
                  typeof media.mime_type === 'string' ? media.mime_type : null,
                caption:
                  typeof media.caption === 'string' ? media.caption : null,
              }
            : null;
          const textBody = asRecord(incoming.text)?.body;
          const text =
            type === 'text' && typeof textBody === 'string'
              ? textBody
              : (attachment?.caption ?? `[${type}]`);
          if (
            type === 'text' &&
            /^(stop|unsubscribe|cancel)$/i.test(String(text).trim())
          ) {
            await this.customers
              .updateOne(
                { _id: customer._id },
                {
                  $set: {
                    whatsappConsent: false,
                    consentAt: null,
                    consentSource: 'whatsapp-opt-out',
                  },
                },
              )
              .exec();
          }
          const providerAt = providerTimestamp(incoming.timestamp);
          const result = await this.messages
            .updateOne(
              { providerMessageId: incoming.id },
              {
                $setOnInsert: {
                  conversationId: conversation._id,
                  providerMessageId: incoming.id,
                  direction: 'inbound',
                  senderId: waId,
                  type: [
                    'text',
                    'image',
                    'document',
                    'audio',
                    'video',
                  ].includes(type)
                    ? type
                    : 'other',
                  text: String(text).slice(0, 4096),
                  attachment,
                  status: 'received',
                  providerAt,
                },
              },
              { upsert: true },
            )
            .exec();
          if (result.upsertedCount === 1) {
            await this.conversations
              .updateOne(
                { _id: conversation._id },
                {
                  $max: {
                    lastInboundAt: providerAt,
                    lastMessageAt: providerAt,
                  },
                  $set: { status: 'open' },
                  $inc: { unreadCount: 1 },
                },
              )
              .exec();
            await this.conversations
              .updateOne(
                { _id: conversation._id, lastMessageAt: { $lte: providerAt } },
                { $set: { lastMessagePreview: String(text).slice(0, 160) } },
              )
              .exec();
            if (conversation.assignedTo) {
              await this.inAppNotifications.create(
                `message:${incoming.id}`,
                'message',
                `New WhatsApp message from ${customer.name}`,
                `/chats?conversation=${String(conversation._id)}`,
                conversation.assignedTo,
              );
            }
          }
        }
        for (const status of asRecords(value.statuses).slice(0, 100)) {
          if (
            typeof status.id !== 'string' ||
            typeof status.status !== 'string' ||
            !['sent', 'delivered', 'read', 'failed'].includes(status.status)
          )
            continue;
          const rank: Record<string, number> = {
            queued: 0,
            sending: 1,
            sent: 2,
            delivered: 3,
            read: 4,
            failed: 5,
          };
          const nextRank = rank[status.status];
          const providerAt = providerTimestamp(status.timestamp);
          await this.statusEvents
            .updateOne(
              { providerMessageId: status.id },
              {
                $setOnInsert: {
                  providerMessageId: status.id,
                  status: status.status,
                  rank: nextRank,
                  providerAt,
                },
              },
              { upsert: true },
            )
            .exec();
          await this.statusEvents
            .updateOne(
              { providerMessageId: status.id, rank: { $lt: nextRank } },
              { $set: { status: status.status, rank: nextRank, providerAt } },
            )
            .exec();
          const lowerStatuses = Object.keys(rank).filter(
            (key) => rank[key] < nextRank,
          );
          await this.messages
            .updateOne(
              { providerMessageId: status.id, status: { $in: lowerStatuses } },
              {
                $set: {
                  status: status.status,
                  providerAt,
                  failure:
                    status.status === 'failed'
                      ? 'Meta reported delivery failure'
                      : null,
                },
              },
            )
            .exec();
        }
      }
    }
  }
}
