import { createHmac } from 'crypto';
import { Request } from 'express';

import { ChatsService } from './chats.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

describe('WhatsAppWebhookController', () => {
  const chats = { receiveWebhook: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = { verifyToken: 'verify-secret', appSecret: 'app-secret' };
  const controller = new WhatsAppWebhookController(
    whatsapp as unknown as WhatsAppService,
    chats as unknown as ChatsService,
  );

  beforeEach(() => chats.receiveWebhook.mockClear());

  it('answers the Meta verification challenge only with the matching token', () => {
    expect(controller.verify('subscribe', 'verify-secret', '12345')).toBe(
      '12345',
    );
    expect(() => controller.verify('subscribe', 'wrong', '12345')).toThrow();
  });

  it('rejects an invalid webhook signature without processing the payload', async () => {
    const request = {
      rawBody: Buffer.from('{"entry":[]}'),
      body: { entry: [] },
      headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) },
    } as unknown as Request & { rawBody: Buffer };
    await expect(controller.receive(request)).rejects.toThrow();
    expect(chats.receiveWebhook).not.toHaveBeenCalled();
  });

  it('accepts a valid raw-body signature and passes the event to the inbox', async () => {
    const rawBody = Buffer.from('{"entry":[]}');
    const signature = createHmac('sha256', 'app-secret')
      .update(rawBody)
      .digest('hex');
    const payload = { entry: [] };
    const request = {
      rawBody,
      body: payload,
      headers: { 'x-hub-signature-256': `sha256=${signature}` },
    } as unknown as Request & { rawBody: Buffer };
    await expect(controller.receive(request)).resolves.toBe('EVENT_RECEIVED');
    expect(chats.receiveWebhook).toHaveBeenCalledWith(payload);
  });
});
