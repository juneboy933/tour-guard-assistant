import { apiClient } from '../api/client';

type ChatResponse = {
  message: string;
};

export function sendAssistantMessage(
  accessToken: string,
  message: string,
): Promise<ChatResponse> {
  return apiClient.withTouristToken(accessToken).request<ChatResponse>('/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
