import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

import { Public, SkipTransform } from '../common/decorators/decorators';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ChatsService } from './chats.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly chats: ChatsService,
  ) {}

  @Get()
  @Public()
  @SkipTransform()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (
      !this.whatsapp.verifyToken ||
      mode !== 'subscribe' ||
      token !== this.whatsapp.verifyToken ||
      !/^\d+$/.test(challenge)
    )
      throw new UnauthorizedException();
    return challenge;
  }

  @Post()
  @Public()
  @HttpCode(200)
  @SkipTransform()
  async receive(
    @Req() request: Request & { rawBody?: Buffer },
  ): Promise<string> {
    const signature = request.headers['x-hub-signature-256'];
    const secret = this.whatsapp.appSecret;
    const body = request.rawBody;
    if (
      !secret ||
      !body ||
      typeof signature !== 'string' ||
      !/^sha256=[a-f0-9]{64}$/i.test(signature)
    )
      throw new UnauthorizedException();
    const expected = createHmac('sha256', secret).update(body).digest();
    const received = Buffer.from(signature.slice(7), 'hex');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(expected, received)
    )
      throw new UnauthorizedException();
    await this.chats.receiveWebhook(request.body as unknown);
    return 'EVENT_RECEIVED';
  }
}
