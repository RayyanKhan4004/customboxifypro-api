import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { isValidObjectId, Model } from 'mongoose';

import { AppLogger } from '../../common/logger/logger.service';
import { MailerService } from './mailer.service';
import {
  NotificationOutbox,
  NotificationOutboxDocument,
} from './notification-outbox.schema';
import {
  WhatsAppProviderError,
  WhatsAppService,
} from '../../whatsapp/whatsapp.service';
import {
  ChatMessage,
  ChatMessageDocument,
} from '../../chats/schemas/message.schema';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  MessageStatusEvent,
  MessageStatusEventDocument,
} from '../../chats/schemas/message-status.schema';

export interface EmailNotificationData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}

class TemplateUnavailableError extends Error {}

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @InjectModel(NotificationOutbox.name)
    private readonly outbox: Model<NotificationOutboxDocument>,
    private readonly mailer: MailerService,
    private readonly logger: AppLogger,
    private readonly whatsapp: WhatsAppService,
    @InjectModel(ChatMessage.name)
    private readonly messages: Model<ChatMessageDocument>,
    private readonly config: ConfigService,
    @InjectModel(MessageStatusEvent.name)
    private readonly statusEvents: Model<MessageStatusEventDocument>,
  ) {}

  onModuleInit(): void {
    if (
      this.config.get('NOTIFICATION_DISPATCH_ENABLED') === false ||
      this.config.get('NOTIFICATION_DISPATCH_ENABLED') === 'false'
    )
      return;
    this.timer = setInterval(() => void this.dispatch(), 5_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sendEmail(data: EmailNotificationData): Promise<void> {
    await this.enqueue(
      'email',
      data.to,
      { ...data },
      data.idempotencyKey ?? randomUUID(),
    );
  }

  async queueHelloWorldTest(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'production')
      throw new ForbiddenException(
        'Test messages are unavailable in production',
      );
    const recipient = this.config.get<string>('WHATSAPP_TEST_RECIPIENT');
    const language =
      this.config.get<string>('WHATSAPP_TEST_TEMPLATE_LANGUAGE') || 'en_US';
    if (
      !this.whatsapp.enabled ||
      !recipient ||
      !/^\+[1-9]\d{7,14}$/.test(recipient)
    )
      throw new BadRequestException(
        'Configure WhatsApp and a verified development test recipient first',
      );
    const status = await this.whatsapp.templateStatus('hello_world', language);
    if (status !== 'APPROVED')
      throw new BadRequestException(
        'hello_world is not approved for the configured WhatsApp Business Account and language',
      );
    await this.enqueue(
      'whatsapp',
      recipient,
      {
        type: 'template',
        template: 'hello_world',
        parameters: [],
        language,
      },
      `whatsapp:test:hello_world:${randomUUID()}`,
    );
  }

  async enqueue(
    channel: 'email' | 'whatsapp',
    recipient: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    status: 'pending' | 'blocked' = 'pending',
  ): Promise<void> {
    await this.outbox
      .updateOne(
        { idempotencyKey },
        {
          $setOnInsert: {
            idempotencyKey,
            channel,
            recipient,
            payload,
            status,
            ...(status === 'blocked'
              ? {
                  failure:
                    'Quote template sending is disabled pending Meta approval',
                }
              : {}),
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        },
        { upsert: true },
      )
      .exec();
  }

  async listFailed() {
    return this.outbox
      .find({ status: { $in: ['failed', 'uncertain', 'blocked'] } })
      .select(
        'channel recipient status attempts failure providerReference createdAt updatedAt',
      )
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  async retry(id: string, allowUncertain = false): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await this.outbox
      .updateOne(
        {
          _id: id,
          status: {
            $in: allowUncertain ? ['failed', 'uncertain'] : ['failed'],
          },
        },
        {
          $set: {
            status: 'pending',
            nextAttemptAt: new Date(),
            leaseUntil: null,
            failure: null,
            attempts: 0,
          },
        },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  private async dispatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let count = 0; count < 10; count += 1) {
        const now = new Date();
        await this.outbox
          .updateMany(
            { status: 'processing', leaseUntil: { $lte: now } },
            {
              $set: {
                status: 'uncertain',
                failure:
                  'Provider response unknown after worker interruption; inspect before retrying',
                leaseUntil: null,
              },
            },
          )
          .exec();
        const job = await this.outbox
          .findOneAndUpdate(
            { status: 'pending', nextAttemptAt: { $lte: now } },
            {
              $set: {
                status: 'processing',
                leaseUntil: new Date(now.getTime() + 60_000),
              },
              $inc: { attempts: 1 },
            },
            { sort: { nextAttemptAt: 1 }, new: true },
          )
          .exec();
        if (!job) break;
        let providerReference: string | null = null;
        try {
          if (job.channel === 'email') {
            const payload = job.payload as unknown as EmailNotificationData;
            await this.mailer.send({
              to: job.recipient,
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
            });
          } else {
            const payload = job.payload as {
              type?: string;
              template?: string;
              parameters?: string[];
              language?: string;
              text?: string;
              messageId?: string;
            };
            if (payload.type === 'template' && payload.template) {
              const status = await this.whatsapp.templateStatus(
                payload.template,
                payload.language || 'en_US',
              );
              if (status !== 'APPROVED')
                throw new TemplateUnavailableError(
                  'Template is not approved for the configured Business Account and language',
                );
            }
            providerReference =
              payload.type === 'template' && payload.template
                ? await this.whatsapp.sendTemplate(
                    job.recipient,
                    payload.template,
                    payload.parameters ?? [],
                    payload.language,
                  )
                : await this.whatsapp.sendText(
                    job.recipient,
                    payload.text ?? '',
                  );
          }
          await this.outbox
            .updateOne(
              { _id: job._id, status: 'processing' },
              {
                $set: {
                  status: 'sent',
                  leaseUntil: null,
                  failure: null,
                  providerReference,
                },
                $unset: { payload: '' },
              },
            )
            .exec();
          if (job.channel === 'whatsapp' && providerReference) {
            const messageId = (job.payload as { messageId?: string }).messageId;
            if (messageId) {
              try {
                const latestStatus = await this.statusEvents
                  .findOne({ providerMessageId: providerReference })
                  .lean()
                  .exec();
                await this.messages
                  .updateOne(
                    { _id: messageId },
                    {
                      $set: {
                        providerMessageId: providerReference,
                        status: latestStatus?.status ?? 'sent',
                        providerAt: latestStatus?.providerAt ?? new Date(),
                      },
                    },
                  )
                  .exec();
              } catch {
                this.logger.error(
                  'message state update failed after provider accepted send',
                  { notificationId: String(job._id), messageId },
                );
              }
            }
          }
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message.slice(0, 250)
              : 'Delivery failed';
          const permanent =
            error instanceof WhatsAppProviderError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429;
          const exhausted = permanent || job.attempts >= 5;
          const uncertain =
            Boolean(providerReference) ||
            (error instanceof Error &&
              (error.name === 'AbortError' ||
                /timeout|timed out|fetch failed|ECONNRESET|socket hang up/i.test(
                  error.message,
                )));
          const finalStatus =
            error instanceof TemplateUnavailableError
              ? 'blocked'
              : uncertain
                ? 'uncertain'
                : exhausted
                  ? 'failed'
                  : 'pending';
          await this.outbox
            .updateOne(
              { _id: job._id, status: 'processing' },
              {
                $set: {
                  status: finalStatus,
                  nextAttemptAt: new Date(
                    Date.now() +
                      Math.min(300_000, 10_000 * 2 ** (job.attempts - 1)),
                  ),
                  leaseUntil: null,
                  failure: reason,
                },
              },
            )
            .exec();
          const messageId =
            job.channel === 'whatsapp'
              ? (job.payload as { messageId?: string }).messageId
              : undefined;
          if (messageId)
            await this.messages
              .updateOne(
                { _id: messageId },
                {
                  $set: {
                    status: finalStatus === 'pending' ? 'queued' : finalStatus,
                    failure: reason,
                  },
                },
              )
              .exec();
          this.logger.warn('notification delivery failed', {
            notificationId: String(job._id),
            channel: job.channel,
          });
        }
      }
    } catch (error) {
      this.logger.error('notification dispatcher failed', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.running = false;
    }
  }
}
