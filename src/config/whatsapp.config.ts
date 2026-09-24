import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppConfig {
  readonly enabled: boolean;
  readonly graphVersion: string;
  readonly accessToken?: string;
  readonly phoneNumberId?: string;
  readonly businessAccountId?: string;
  readonly verifyToken?: string;
  readonly appSecret?: string;
  readonly confirmationTemplate?: string;
  readonly quoteTemplateEnabled: boolean;
  readonly testRecipient?: string;
  readonly testTemplateLanguage: string;
  readonly language: string;

  constructor(config: ConfigService) {
    this.enabled =
      config.get('WHATSAPP_ENABLED') === true ||
      config.get('WHATSAPP_ENABLED') === 'true';
    this.graphVersion = config.get<string>('WHATSAPP_GRAPH_API_VERSION') ?? '';
    this.accessToken = config.get<string>('WHATSAPP_ACCESS_TOKEN') || undefined;
    this.phoneNumberId =
      config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || undefined;
    this.businessAccountId =
      config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID') || undefined;
    this.verifyToken =
      config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || undefined;
    this.appSecret = config.get<string>('WHATSAPP_APP_SECRET') || undefined;
    this.confirmationTemplate =
      config.get<string>('WHATSAPP_CONFIRMATION_TEMPLATE') || undefined;
    this.quoteTemplateEnabled =
      config.get('WHATSAPP_QUOTE_TEMPLATE_ENABLED') === true ||
      config.get('WHATSAPP_QUOTE_TEMPLATE_ENABLED') === 'true';
    this.testRecipient =
      config.get<string>('WHATSAPP_TEST_RECIPIENT') || undefined;
    this.testTemplateLanguage =
      config.get<string>('WHATSAPP_TEST_TEMPLATE_LANGUAGE') || 'en_US';
    this.language =
      config.get<string>('WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE') ?? 'en_US';
  }
}
