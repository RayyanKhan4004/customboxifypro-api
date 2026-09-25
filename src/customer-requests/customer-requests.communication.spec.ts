import { Types } from 'mongoose';

import { CustomerRequestsService } from './customer-requests.service';
import { SubmitCustomerRequestDto } from './dto/customer-request.dto';

describe('quote communication submission', () => {
  const id = new Types.ObjectId('507f1f77bcf86cd799439011');
  const dto: SubmitCustomerRequestDto = {
    requestType: 'custom-quote',
    contact: {
      name: 'John Doe',
      email: 'JOHN@example.com',
      phone: '+15551692329',
    },
    consent: true,
    whatsappOptIn: true,
    idempotencyKey: 'unique-quote-key-123',
  };
  const record = {
    _id: id,
    status: 'new',
    requestType: 'custom-quote',
    contact: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+15551692329',
    },
    whatsappOptIn: true,
    quantity: 100,
    productName: 'Mailer boxes',
  };
  const repository = {
    findByIdempotencyKey: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue(null),
  };
  const spamGuard = { verify: jest.fn().mockResolvedValue(true) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const media = {
    assertReadyRequestAttachments: jest.fn().mockResolvedValue(undefined),
  };
  const chats = {
    linkQuote: jest.fn().mockResolvedValue({
      customerId: new Types.ObjectId(),
      conversationId: new Types.ObjectId(),
    }),
    queueQuoteConfirmation: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(false) };
  const inApp = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new CustomerRequestsService(
    repository as never,
    spamGuard as never,
    audit as never,
    media as never,
    chats as never,
    notifications as never,
    config as never,
    inApp as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.update.mockResolvedValue(null);
    spamGuard.verify.mockResolvedValue(true);
    chats.linkQuote.mockResolvedValue({
      customerId: new Types.ObjectId(),
      conversationId: new Types.ObjectId(),
    });
    config.get.mockReturnValue(false);
  });

  it('saves a quote, links a conversation, queues confirmation, and returns its reference', async () => {
    repository.findByIdempotencyKey.mockResolvedValue(null);
    repository.create.mockResolvedValue(record);
    const response = await service.submit(dto, '127.0.0.1');
    expect(response).toMatchObject({
      id: String(id),
      status: 'new',
      quoteNumber: 'CB-99439011',
    });
    const [[saved]] = repository.create.mock.calls as unknown as [
      [
        {
          contact: { email: string };
          whatsappOptIn: boolean;
        },
      ],
    ];
    expect(saved.contact.email).toBe('john@example.com');
    expect(saved.whatsappOptIn).toBe(true);
    expect(chats.queueQuoteConfirmation).toHaveBeenCalledTimes(1);
    expect(inApp.create).toHaveBeenCalledTimes(1);
  });

  it('returns the same quote for a repeated idempotency key', async () => {
    repository.findByIdempotencyKey.mockResolvedValue({
      ...record,
      quoteNumber: 'CB-99439011',
    });
    const response = await service.submit(dto, undefined);
    expect(response.quoteNumber).toBe('CB-99439011');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('queues an opted-in confirmation without linking another customer’s conversation', async () => {
    repository.findByIdempotencyKey.mockResolvedValue(null);
    repository.create.mockResolvedValue(record);
    chats.linkQuote.mockResolvedValue({
      customerId: new Types.ObjectId(),
      conversationId: null,
      conversationSkipReason: 'phone_linked_to_different_customer',
    });
    const response = await service.submit(dto, undefined);
    expect(response.conversationId).toBeNull();
    expect(chats.queueQuoteConfirmation).toHaveBeenCalledWith(
      null,
      id,
      'John Doe',
      'CB-99439011',
      '+15551692329',
    );
  });

  it('rejects WhatsApp opt-in without a valid E.164 number', async () => {
    await expect(
      service.submit(
        { ...dto, contact: { ...dto.contact, phone: '555-169-2329' } },
        undefined,
      ),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });
});
