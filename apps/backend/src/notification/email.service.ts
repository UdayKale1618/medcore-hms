import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'notifications@medcore.com';
    this.fromName = process.env.RESEND_FROM_NAME || 'MedCore HMS';
  }

  async sendEmail(
    options: SendEmailOptions,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!options.to || !options.subject) {
        return { success: false, error: 'Recipient and subject are required' };
      }

      // Safe fallback / test mode if no live API key
      if (!this.apiKey || this.apiKey.includes('placeholder') || this.apiKey.startsWith('mock_')) {
        this.logger.log(
          `[Email Mock Mode] To: ${options.to} | Subject: "${options.subject}"`,
        );
        return { success: true, id: `mock-email-${Date.now()}` };
      }

      // Live Resend API call
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`Resend API error status: ${response.status} - ${errorText}`);
        return { success: false, error: `Resend error: ${response.status}` };
      }

      const data = (await response.json()) as { id: string };
      this.logger.log(`Email dispatched successfully to ${options.to} (id: ${data.id})`);
      return { success: true, id: data.id };
    } catch (err) {
      // Safe error handling: never bubble up to break core transactions
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send email to ${options.to}: ${message}`);
      return { success: false, error: message };
    }
  }
}
