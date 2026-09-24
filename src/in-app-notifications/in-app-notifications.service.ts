import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import {
  InAppNotification,
  InAppNotificationDocument,
} from './in-app-notification.schema';

@Injectable()
export class InAppNotificationsService {
  constructor(
    @InjectModel(InAppNotification.name)
    private readonly notifications: Model<InAppNotificationDocument>,
  ) {}

  async create(
    eventKey: string,
    type: 'quote' | 'message',
    title: string,
    href: string,
    recipientId?: Types.ObjectId,
  ): Promise<void> {
    await this.notifications
      .updateOne(
        { eventKey },
        {
          $setOnInsert: {
            eventKey,
            type,
            title,
            href,
            recipientId: recipientId ?? null,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  private visibility(admin: AdminPrincipal): Record<string, unknown> {
    return {
      $or: [
        { recipientId: new Types.ObjectId(admin.id) },
        ...(admin.permissions.includes('requests.read')
          ? [{ recipientId: null, type: 'quote' }]
          : []),
      ],
    };
  }

  async list(admin: AdminPrincipal) {
    const filter = this.visibility(admin);
    const [items, unread] = await Promise.all([
      this.notifications
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec(),
      this.notifications
        .countDocuments({
          ...filter,
          readBy: { $ne: new Types.ObjectId(admin.id) },
        })
        .exec(),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        readAt: item.readBy.some((id) => String(id) === admin.id)
          ? item.createdAt
          : null,
        readBy: undefined,
      })),
      unread,
    };
  }

  async markRead(id: string, admin: AdminPrincipal) {
    await this.notifications
      .updateOne(
        { _id: id, ...this.visibility(admin) },
        { $addToSet: { readBy: new Types.ObjectId(admin.id) } },
      )
      .exec();
    return { read: true };
  }
}
