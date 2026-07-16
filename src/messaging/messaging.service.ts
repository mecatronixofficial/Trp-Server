import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type OtpChannel = 'sms' | 'whatsapp';

@Injectable()
export class MessagingService {
  constructor(private config: ConfigService) {}

  async sendOtp(channel: OtpChannel, to: string, otp: string) {
    const message = `Your Tiruppur Ice admin password reset OTP is ${otp}. It expires in 10 minutes.`;
    return this.sendMessage(channel, to, message);
  }

  async sendWhatsapp(to: string, message: string) {
    return this.sendMessage('whatsapp', to, message);
  }

  private async sendMessage(channel: OtpChannel, to: string, message: string) {
    const webhookDelivery = await this.sendWebhookMessage(channel, to, message);
    if (webhookDelivery) return webhookDelivery;

    const twilioDelivery = await this.sendTwilioMessage(channel, to, message);
    if (twilioDelivery) return twilioDelivery;

    if (this.config.get<string>('OTP_CONSOLE_FALLBACK') === 'true') {
      console.log(`Admin password reset OTP message for ${to}: ${message}`);
      return 'logged';
    }

    throw new BadRequestException(`Configure ${channel === 'sms' ? 'SMS' : 'WhatsApp'} OTP delivery first.`);
  }

  private async sendWebhookMessage(channel: OtpChannel, to: string, message: string) {
    const envName = channel === 'sms' ? 'SMS_OTP_WEBHOOK_URL' : 'WHATSAPP_OTP_WEBHOOK_URL';
    const webhookUrl = this.config.get<string>(envName);
    if (!webhookUrl) return null;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, to, message }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Could not send ${channel === 'sms' ? 'SMS' : 'WhatsApp'} OTP.`);
    }

    return 'sent';
  }

  private async sendTwilioMessage(channel: OtpChannel, to: string, message: string) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>(channel === 'sms' ? 'TWILIO_SMS_FROM' : 'TWILIO_WHATSAPP_FROM');

    if (!accountSid || !authToken || !from) return null;

    const twilioTo = channel === 'whatsapp' ? this.toWhatsappAddress(to) : this.toE164Number(to);
    const twilioFrom = channel === 'whatsapp' ? this.toWhatsappAddress(from) : this.toE164Number(from);
    const body = new URLSearchParams({
      From: twilioFrom,
      To: twilioTo,
      Body: message,
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new BadRequestException(`Could not send ${channel === 'sms' ? 'SMS' : 'WhatsApp'} OTP.`);
    }

    return 'sent';
  }

  private toWhatsappAddress(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith('whatsapp:')) return trimmed;
    return `whatsapp:${this.toE164Number(trimmed)}`;
  }

  private toE164Number(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith('+')) return `+${trimmed.replace(/\D/g, '')}`;

    const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
    const countryCode = this.config.get<string>('DEFAULT_PHONE_COUNTRY_CODE') || '+91';
    return `${countryCode}${digits}`;
  }
}
