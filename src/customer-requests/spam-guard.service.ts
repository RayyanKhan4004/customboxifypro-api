import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Spam defense for public submissions. reCAPTCHA v2/v3 verification is used
 * when RECAPTCHA_SECRET is configured; otherwise submissions are accepted
 * (verification is a no-op) so local/dev setups work without Google setup.
 */
@Injectable()
export class SpamGuardService {
  private readonly secret?: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('RECAPTCHA_SECRET') || undefined;
  }

  get configured(): boolean {
    return this.secret !== undefined;
  }

  async verify(token: string | undefined): Promise<boolean> {
    if (!this.secret) return true;
    if (!token) return false;
    try {
      const body = new URLSearchParams({
        secret: this.secret,
        response: token,
      });
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );
      const data = (await response.json()) as { success?: boolean };
      return data.success === true;
    } catch {
      return false;
    }
  }
}
