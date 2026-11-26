import { Injectable } from '@nestjs/common';

export const SMS_SERVICE = Symbol('SMS_SERVICE');

export interface SmsService {
  sendSms(phone: string, message: string): Promise<void>;
}

@Injectable()
export class NoopSmsService implements SmsService {
  async sendSms(_phone: string, _message: string): Promise<void> {
    // The MVP keeps provider integration behind this boundary.
  }
}
