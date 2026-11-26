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
      const response = await client.SMS.send({
        to: phone,
        message,
        ...(senderId ? { senderId } : {}),
      });
      assertDelivered(response);
    } catch {
      throw new ServiceUnavailableException('SMS provider is unavailable.');
    }
  }
}

// Africa's Talking status codes: 100 Processed, 101 Sent, 102 Queued.
const ACCEPTED_STATUS_CODES = new Set([100, 101, 102]);

function assertDelivered(response: unknown): void {
  const data = (
    response as {
      SMSMessageData?: { Recipients?: Array<{ statusCode?: number }> };
    }
  )?.SMSMessageData;
  const recipients = data?.Recipients ?? [];

  if (
    recipients.length === 0 ||
    !recipients.every((r) => ACCEPTED_STATUS_CODES.has(Number(r.statusCode)))
  ) {
    throw new Error('SMS was not accepted by the provider.');
  }
}
