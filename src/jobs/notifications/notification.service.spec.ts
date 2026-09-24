import { Types } from 'mongoose';

import { NotificationService } from './notification.service';

describe('MongoDB notification outbox', () => {
  const outbox = {
    updateOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    }),
    updateMany: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    findOneAndUpdate: jest.fn(),
  };
  const mailer = { send: jest.fn() };
  const whatsapp = {
    sendTemplate: jest.fn(),
    sendText: jest.fn(),
    templateStatus: jest.fn(),
    enabled: true,
  };
  const messages = {
    updateOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
  const logger = { warn: jest.fn(), error: jest.fn() };
  const config = { get: jest.fn() };
  const statusEvents = { findOne: jest.fn() };
  const service = new NotificationService(
    outbox as never,
    mailer as never,
    logger as never,
    whatsapp as never,
    messages as never,
    config as never,
    statusEvents as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReset();
    outbox.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    outbox.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
  });

  it('upserts an email by idempotency key', async () => {
    await service.sendEmail({
      to: 'customer@example.com',
      subject: 'Quote',
      html: '<p>Received</p>',
      idempotencyKey: 'quote:1:email',
    });
    const [[, insert]] = outbox.updateOne.mock.calls as unknown as [
      [unknown, { $setOnInsert: { channel: string; status: string } }],
    ];
    expect(insert.$setOnInsert.channel).toBe('email');
    expect(insert.$setOnInsert.status).toBe('pending');
  });

  it('claims due work atomically and sends it once', async () => {
    const job = {
      _id: new Types.ObjectId(),
      channel: 'email',
      recipient: 'customer@example.com',
      payload: { subject: 'Quote', html: '<p>Received</p>' },
      attempts: 1,
    };
    outbox.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(job) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
    mailer.send.mockResolvedValue(undefined);
    await (service as unknown as { dispatch(): Promise<void> }).dispatch();
    expect(outbox.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.objectContaining({ $inc: { attempts: 1 } }),
      expect.any(Object),
    );
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const [[, sent]] = outbox.updateOne.mock.calls as unknown as [
      [unknown, { $set: { status: string } }],
    ];
    expect(sent.$set.status).toBe('sent');
  });

  it('marks an ambiguous provider timeout uncertain instead of automatically retrying', async () => {
    const job = {
      _id: new Types.ObjectId(),
      channel: 'whatsapp',
      recipient: '+15551692329',
      payload: {
        type: 'text',
        text: 'Hello',
        messageId: String(new Types.ObjectId()),
      },
      attempts: 1,
    };
    outbox.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(job) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
    const timeout = new Error('request timed out');
    timeout.name = 'AbortError';
    whatsapp.sendText.mockRejectedValue(timeout);
    await (service as unknown as { dispatch(): Promise<void> }).dispatch();
    const [[, uncertain]] = outbox.updateOne.mock.calls as unknown as [
      [unknown, { $set: { status: string } }],
    ];
    expect(uncertain.$set.status).toBe('uncertain');
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
  });

  it('requires explicit confirmation before retrying an uncertain delivery', async () => {
    const id = String(new Types.ObjectId());
    await service.retry(id);
    expect(outbox.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['failed'] } }),
      expect.any(Object),
    );
    await service.retry(id, true);
    expect(outbox.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['failed', 'uncertain'] } }),
      expect.any(Object),
    );
  });

  it('stores an unavailable quote template as blocked without sending it', async () => {
    const job = {
      _id: new Types.ObjectId(),
      channel: 'whatsapp',
      recipient: '+15551234567',
      payload: {
        type: 'template',
        template: 'quote_received',
        language: 'en',
        parameters: ['John', 'CB-1024'],
      },
      attempts: 1,
    };
    outbox.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(job) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
    whatsapp.templateStatus.mockResolvedValue('PENDING');
    await (service as unknown as { dispatch(): Promise<void> }).dispatch();
    const [[, update]] = outbox.updateOne.mock.calls as unknown as [
      [unknown, { $set: { status: string } }],
    ];
    expect(update.$set.status).toBe('blocked');
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('refuses a live test without a configured recipient', async () => {
    config.get.mockImplementation((name: string) =>
      name === 'NODE_ENV' ? 'development' : undefined,
    );
    await expect(service.queueHelloWorldTest()).rejects.toThrow(
      'verified development test recipient',
    );
    expect(outbox.updateOne).not.toHaveBeenCalled();
  });

  it('queues hello_world only for a configured development recipient', async () => {
    config.get.mockImplementation(
      (name: string) =>
        ({
          NODE_ENV: 'development',
          WHATSAPP_TEST_RECIPIENT: '+15551234567',
          WHATSAPP_TEST_TEMPLATE_LANGUAGE: 'en_US',
        })[name],
    );
    whatsapp.templateStatus.mockResolvedValue('APPROVED');
    await service.queueHelloWorldTest();
    const [[, insert]] = outbox.updateOne.mock.calls as unknown as [
      [
        unknown,
        {
          $setOnInsert: {
            recipient: string;
            payload: { template: string; parameters: string[] };
            status: string;
          };
        },
      ],
    ];
    expect(insert.$setOnInsert.recipient).toBe('+15551234567');
    expect(insert.$setOnInsert.payload).toMatchObject({
      template: 'hello_world',
      parameters: [],
    });
    expect(insert.$setOnInsert.status).toBe('pending');
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('never queues a hello_world test in production', async () => {
    config.get.mockReturnValue('production');
    await expect(service.queueHelloWorldTest()).rejects.toThrow(
      'unavailable in production',
    );
    expect(outbox.updateOne).not.toHaveBeenCalled();
  });
});
