import { Injectable } from '@nestjs/common';

import { WhatsAppConfig } from '../config/whatsapp.config';

interface MetaSendResponse {
  messages?: Array<{ id: string }>;
}

export class WhatsAppProviderError extends Error {
  constructor(public readonly status: number) {
    super(`Meta WhatsApp rejected the message (${status})`);
  }
}

@Injectable()
export class WhatsAppService {
  constructor(private readonly config: WhatsAppConfig) {}

  get enabled(): boolean {
    return this.config.enabled;
  }
  get phoneNumberId(): string | undefined {
    return this.config.phoneNumberId;
  }
  get confirmationTemplate(): string | undefined {
    return this.config.confirmationTemplate;
  }
  get language(): string {
    return this.config.language;
  }
  get verifyToken(): string | undefined {
    return this.config.verifyToken;
  }
  get appSecret(): string | undefined {
    return this.config.appSecret;
  }

  async sendText(to: string, text: string): Promise<string> {
    return this.send({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body: text },
    });
  }

  async sendTemplate(
    to: string,
    name: string,
    parameters: string[],
    language = this.config.language,
  ): Promise<string> {
    return this.send({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name,
        language: { code: language },
        ...(parameters.length
          ? {
              components: [
                {
                  type: 'body',
                  parameters: parameters.map((text) => ({
                    type: 'text',
                    text,
                  })),
                },
              ],
            }
          : {}),
      },
    });
  }

  async templateStatus(name: string, language: string): Promise<string | null> {
    if (
      !this.config.enabled ||
      !this.config.accessToken ||
      !this.config.businessAccountId ||
      !this.config.graphVersion
    )
      throw new Error('WhatsApp template lookup is not configured');
    const url = new URL(
      `https://graph.facebook.com/${this.config.graphVersion}/${this.config.businessAccountId}/message_templates`,
    );
    url.searchParams.set('name', name);
    url.searchParams.set('fields', 'name,language,status');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new WhatsAppProviderError(response.status);
    const result = (await response.json()) as {
      data?: Array<{ name?: string; language?: string; status?: string }>;
    };
    return (
      result.data?.find(
        (item) => item.name === name && item.language === language,
      )?.status ?? null
    );
  }

  async downloadMedia(id: string): Promise<{ data: Buffer; mimeType: string }> {
    if (
      !this.config.enabled ||
      !this.config.accessToken ||
      !this.config.graphVersion ||
      !/^\d+$/.test(id)
    )
      throw new Error('WhatsApp media is unavailable');
    const metadata = await fetch(
      `https://graph.facebook.com/${this.config.graphVersion}/${id}`,
      {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!metadata.ok)
      throw new Error(`Meta media lookup failed (${metadata.status})`);
    const details = (await metadata.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!details.url || (details.file_size ?? 0) > 16 * 1024 * 1024)
      throw new Error('Media is missing or too large');
    const url = new URL(details.url);
    if (
      url.protocol !== 'https:' ||
      !/(^|\.)fbcdn\.net$|(^|\.)facebook\.com$|^lookaside\.fbsbx\.com$/.test(
        url.hostname,
      )
    )
      throw new Error('Unexpected media origin');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new Error(`Meta media download failed (${response.status})`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 16 * 1024 * 1024) throw new Error('Media is too large');
    const mimeType =
      details.mime_type ??
      response.headers.get('content-type') ??
      'application/octet-stream';
    if (
      !/^(image\/(jpeg|png|webp)|application\/pdf|audio\/(ogg|mpeg|mp4)|video\/mp4)$/.test(
        mimeType,
      )
    )
      throw new Error('This media type is not supported for download');
    return { data, mimeType };
  }

  private async send(body: Record<string, unknown>): Promise<string> {
    if (
      !this.config.enabled ||
      !this.config.accessToken ||
      !this.config.phoneNumberId ||
      !this.config.graphVersion
    ) {
      throw new Error('WhatsApp is not configured');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new WhatsAppProviderError(response.status);
    const result = (await response.json()) as MetaSendResponse;
    const id = result.messages?.[0]?.id;
    if (!id) throw new Error('Meta WhatsApp did not return a message ID');
    return id;
  }
}
