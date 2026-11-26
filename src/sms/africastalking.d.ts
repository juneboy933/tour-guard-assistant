declare module 'africastalking' {
  interface SmsClient {
    SMS: {
      send(params: {
        to: string;
        message: string;
        senderId?: string;
      }): Promise<unknown>;
    };
  }

  function africastalking(options: { username: string; apiKey: string }): SmsClient;
  export default africastalking;
}
