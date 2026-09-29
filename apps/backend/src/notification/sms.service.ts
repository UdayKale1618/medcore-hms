import { Injectable, Logger } from '@nestjs/common';

export interface SendSmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid: string | undefined;
  private readonly authToken: string | undefined;
  private readonly fromPhone: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromPhone = process.env.TWILIO_PHONE_NUMBER || '+15550001111';
  }

  async sendSms(
    options: SendSmsOptions,
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
      if (!options.to || !options.message) {
        return { success: false, error: 'Recipient phone and message are required' };
      }

      // Safe fallback / test mode if no live Twilio credentials
      if (
        !this.accountSid ||
        !this.authToken ||
        this.accountSid.includes('placeholder') ||
        this.accountSid.startsWith('mock_')
      ) {
        this.logger.log(
          `[SMS Mock Mode] To: ${options.to} | Message: "${options.message}"`,
        );
        return { success: true, sid: `mock-sms-${Date.now()}` };
      }

      // Live Twilio REST API call
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', options.to);
      formData.append('From', this.fromPhone);
      formData.append('Body', options.message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(`Twilio SMS API error status: ${response.status} - ${errText}`);
        return { success: false, error: `Twilio error: ${response.status}` };
      }

      const data = (await response.json()) as { sid: string };
      this.logger.log(`SMS dispatched successfully to ${options.to} (sid: ${data.sid})`);
      return { success: true, sid: data.sid };
    } catch (err) {
      // Safe error handling: never bubble up to break core transactions
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send SMS to ${options.to}: ${message}`);
      return { success: false, error: message };
    }
  }
}
