import { apiClient } from '../api/client';

export type LostReportInput = {
  note?: string;
  lat?: number;
  lng?: number;
};

export type ReportSummary = {
  publicReference: string;
  type: 'LOST' | 'MISSING';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
};

type ReportResponse = {
  status: 'ok';
  data: ReportSummary;
};

export function createLostReport(
  accessToken: string,
  input: LostReportInput,
): Promise<ReportResponse> {
  return apiClient.withTouristToken(accessToken).request<ReportResponse>('/reports/lost', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createMissingReport(
  accessToken: string,
  missingTouristReference: string,
  input: LostReportInput,
): Promise<ReportResponse> {
  return apiClient.withTouristToken(accessToken).request<ReportResponse>('/reports/missing', {
    method: 'POST',
    body: JSON.stringify({ ...input, missingTouristReference }),
  });
}

export function getReportStatus(
  accessToken: string,
  reportReference: string,
): Promise<ReportResponse> {
  return apiClient
    .withTouristToken(accessToken)
    .request<ReportResponse>(`/reports/status/${reportReference}`);
}
