import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  constructor(private config: ConfigService) {}

  async send(options: SendMailOptions) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM_EMAIL') || 'Tiruppur Ice <onboarding@resend.dev>';

    if (!apiKey) {
      console.log(`Email to ${options.to}: ${options.subject}\n${options.text}`);
      return 'logged';
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Could not send email.');
    }

    return 'sent';
  }
}
