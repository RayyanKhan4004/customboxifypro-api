import { Types } from 'mongoose';

import { ChatsService } from './chats.service';

describe('ChatsService access and messaging', () => {
  const adminId = String(new Types.ObjectId());
  const otherId = String(new Types.ObjectId());
  const conversationId = String(new Types.ObjectId());
  const assigned = {
    id: adminId,
    permissions: ['chats.read', 'chats.reply'],
  } as never;
  const admin = {
    id: adminId,
    permissions: ['chats.read', 'chats.read_all'],
  } as never;
  const conversation = {
    _id: new Types.ObjectId(conversationId),
    assignedTo: new Types.ObjectId(adminId),
    waId: '15551692329',
    lastInboundAt: new Date(),
  };
  const conversations = {
    findOne: jest.fn(),
    updateOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
  const messages = { updateOne: jest.fn(), findOne: jest.fn() };
  const customers = { findOneAndUpdate: jest.fn(), findById: jest.fn() };
  const notifications = { enqueue: jest.fn() };
  const audit = { log: jest.fn() };
  const config = {
    enabled: true,
    phoneNumberId: 'test-sender',
    confirmationTemplate: 'quote_received',
    quoteTemplateEnabled: true,
    language: 'en_US',
  };
  const statusEvents = {
    updateOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
  const service = new ChatsService(
    customers as never,
    conversations as never,
    messages as never,
    {} as never,
    audit as never,
    config as never,
    notifications as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    statusEvents as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('limits assigned agents to their own conversation in the database query', async () => {
    conversations.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getVisible(conversationId, {
        id: otherId,
        permissions: ['chats.read'],
      } as never),
    ).rejects.toThrow('Conversation not found');
    expect(conversations.findOne).toHaveBeenCalledWith({
      _id: conversationId,
      assignedTo: new Types.ObjectId(otherId),
    });
  });

  it('lets read-all administrators access a conversation without an assignment filter', async () => {
    conversations.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(conversation),
    });
    await expect(service.getVisible(conversationId, admin)).resolves.toBe(
      conversation,
    );
    expect(conversations.findOne).toHaveBeenCalledWith({ _id: conversationId });
  });

  it('blocks a free-form reply when the inbound service window has expired', async () => {
    conversations.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...conversation,
        lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      }),
    });
    await expect(
      service.sendText(
        conversationId,
        { text: 'Hello', idempotencyKey: 'message-id-123' },
        assigned,
      ),
    ).rejects.toThrow('24-hour');
    expect(notifications.enqueue).not.toHaveBeenCalled();
  });

  it('does not increment unread count on a duplicate inbound webhook message', async () => {
    customers.findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId(), name: 'John' }),
    });
    conversations.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    // A duplicate provider message ID matches an existing message, so upsertedCount is zero.
    const conversationModel = conversations as typeof conversations & {
      findOneAndUpdate?: jest.Mock;
    };
    conversationModel.findOneAndUpdate = jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(conversation) });
    messages.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ upsertedCount: 0 }),
    });
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'test-sender' },
                messages: [
                  {
                    id: 'wamid.duplicate',
                    from: '15551692329',
                    type: 'text',
                    text: { body: 'Hello' },
                    timestamp: '1700000000',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await service.receiveWebhook(payload);
    expect(messages.updateOne).toHaveBeenCalledTimes(1);
    expect(conversations.updateOne).not.toHaveBeenCalled();
  });

  it('does not downgrade a read receipt when an older delivered status arrives', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'test-sender' },
                statuses: [
                  {
                    id: 'wamid.1',
                    status: 'delivered',
                    timestamp: '1700000000',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await service.receiveWebhook(payload);
    expect(messages.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMessageId: 'wamid.1',
        status: { $in: ['queued', 'sending', 'sent'] },
      }),
      expect.any(Object),
    );
  });

  it('creates a conversation for a consented E.164 quote and links its quote ID', async () => {
    const quoteId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    conversations.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    customers.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: customerId }),
    });
    const conversationModel = conversations as typeof conversations & {
      findOneAndUpdate?: jest.Mock;
    };
    conversationModel.findOneAndUpdate = jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(conversation) });
    const linked = await service.linkQuote(
      quoteId,
      { name: 'John', email: 'JOHN@example.com', phone: '+15551692329' },
      true,
    );
    expect(linked.conversationId).toEqual(conversation._id);
    expect(linked.conversationSkipReason).toBeNull();
    expect(conversationModel.findOneAndUpdate).toHaveBeenCalledWith(
      { phoneNumberId: 'test-sender', waId: '15551692329' },
      expect.objectContaining({ $addToSet: { quoteIds: quoteId } }),
      { upsert: true, new: true },
    );
  });

  it('records why a quote cannot be linked without an international phone', async () => {
    customers.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    });
    const linked = await service.linkQuote(
      new Types.ObjectId(),
      { name: 'John', email: 'john@example.com' },
      false,
    );
    expect(linked.conversationId).toBeNull();
    expect(linked.conversationSkipReason).toBe('phone_missing_or_invalid');
  });

  it('queues a confirmation without attaching the quote to a different customer conversation', async () => {
    const quoteId = new Types.ObjectId();
    await service.queueQuoteConfirmation(
      null,
      quoteId,
      'John',
      'CB-123',
      '+15551692329',
    );
    expect(conversations.findOne).not.toHaveBeenCalled();
    expect(messages.findOne).not.toHaveBeenCalled();
    expect(notifications.enqueue).toHaveBeenCalledWith(
      'whatsapp',
      '+15551692329',
      {
        type: 'template',
        template: 'quote_received',
        parameters: ['John', 'CB-123'],
        language: 'en_US',
      },
      `quote:${String(quoteId)}:whatsapp`,
      'pending',
    );
  });
});
