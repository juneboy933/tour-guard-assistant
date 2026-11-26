import { ServiceUnavailableException } from '@nestjs/common';
import { vi } from 'vitest';
import { AfricasTalkingSmsService } from './africas-talking.sms.service.js';

const sdkMocks = vi.hoisted(() => ({
  send: vi.fn(),
  client: vi.fn(),
}));

vi.mock('africastalking', () => ({
  default: sdkMocks.client,
}));

describe('AfricasTalkingSmsService', () => {
  const originalUsername = process.env.AT_USERNAME;
  const originalApiKey = process.env.AT_API_KEY;
  const originalSenderId = process.env.AT_SENDER_ID;
  const originalShortCode = process.env.AT_SHORTCODE;

  beforeEach(() => {
    process.env.AT_USERNAME = 'sandbox';
    process.env.AT_API_KEY = 'test-api-key';
    process.env.AT_SENDER_ID = 'TourGuard';
    process.env.AT_SHORTCODE = '12345';
    sdkMocks.client.mockReturnValue({ SMS: { send: sdkMocks.send } });
    sdkMocks.send.mockResolvedValue({ SMSMessageData: { Recipients: [] } });
  });

  afterEach(() => {
    process.env.AT_USERNAME = originalUsername;
    process.env.AT_API_KEY = originalApiKey;
    process.env.AT_SENDER_ID = originalSenderId;
    process.env.AT_SHORTCODE = originalShortCode;
    vi.clearAllMocks();
  });

  it('sends SMS through Africa’s Talking', async () => {
    const service = new AfricasTalkingSmsService();

    await service.sendSms('+254712345678', 'Your TourGuard link.');

    expect(sdkMocks.client).toHaveBeenCalledWith({
      username: 'sandbox',
      apiKey: 'test-api-key',
    });
    expect(sdkMocks.send).toHaveBeenCalledWith({
      to: '+254712345678',
      message: 'Your TourGuard link.',
      senderId: '12345',
    });
  });

  it('fails safely when provider credentials are missing', async () => {
    delete process.env.AT_API_KEY;

    await expect(new AfricasTalkingSmsService().sendSms('+254712345678', 'Hello'))
      .rejects.toThrow(ServiceUnavailableException);
    expect(sdkMocks.client).not.toHaveBeenCalled();
  });

  it('maps provider failures to a safe error', async () => {
    sdkMocks.send.mockRejectedValue(new Error('provider secret')); 

    await expect(new AfricasTalkingSmsService().sendSms('+254712345678', 'Hello'))
      .rejects.toThrow(ServiceUnavailableException);
  });
});
