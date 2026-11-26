import { apiClient } from '../api/client';

export type TouristContext = {
  name: string;
  phone: string;
  publicReference: string;
  tour: {
    name: string;
    description: string;
    meetingPoint: string;
    startAt: string;
    endAt: string;
    guide: {
      name: string;
      phone: string;
    };
  };
};

type TouristContextResponse = {
  status: 'ok';
  data: TouristContext;
};

export function getTouristContext(accessToken: string): Promise<TouristContextResponse> {
  return apiClient
    .withTouristToken(accessToken)
    .request<TouristContextResponse>('/tourists/context');
}
