import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

import { AppLogger } from '../../common/logger/logger.service';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailerService {
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(
    config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    const host = config.get<string>('SMTP_HOST');
    this.from =
      config.get<string>('EMAIL_FROM') ?? 'Boxify <no-reply@localhost>';
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get('SMTP_PORT') ?? 587),
        secure: config.get<string>('SMTP_SECURE') === 'true',
        auth:
          config.get('SMTP_USER') && config.get('SMTP_PASS')
            ? {
                user: config.get<string>('SMTP_USER')!,
                pass: config.get<string>('SMTP_PASS')!,
              }
            : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      // Development fallback: never send real mail without SMTP.
      this.logger.info('email (not sent, SMTP unconfigured)', {
        to: message.to,
        subject: message.subject,
      });
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    this.logger.info('email sent', {
      to: message.to,
      subject: message.subject,
    });
  }
}
