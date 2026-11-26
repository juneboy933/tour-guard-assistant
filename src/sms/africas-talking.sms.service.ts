import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import africastalking from 'africastalking';
import type { SmsService } from './sms.service.js';

@Injectable()
export class AfricasTalkingSmsService implements SmsService {
  async sendSms(phone: string, message: string): Promise<void> {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;

    if (!username || !apiKey) {
      throw new ServiceUnavailableException('SMS provider is not configured.');
    }

    try {
      const client = africastalking({ username, apiKey });
      const senderId = process.env.AT_SHORTCODE ?? process.env.AT_SENDER_ID;
      await client.SMS.send({
        to: phone,
        message,
        ...(senderId ? { senderId } : {}),
      });
    } catch {
      throw new ServiceUnavailableException('SMS provider is unavailable.');
    }
  }
}
