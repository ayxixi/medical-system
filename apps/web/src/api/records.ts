import { apiClient } from './client';
import type { DiagnosisRecord } from './visits';

export async function listRecordsByVisit(visitId: string): Promise<DiagnosisRecord[]> {
  const { data } = await apiClient.get<DiagnosisRecord[]>(`/visits/${visitId}/records`);
  return data;
}

export async function createRecord(payload: {
  visitId: string;
  diagnosis: string;
}): Promise<DiagnosisRecord> {
  const { data } = await apiClient.post<DiagnosisRecord>('/records', payload);
  return data;
}

export async function updateRecord(
  id: string,
  payload: { diagnosis: string },
): Promise<DiagnosisRecord> {
  const { data } = await apiClient.patch<DiagnosisRecord>(`/records/${id}`, payload);
  return data;
}

export async function deleteRecord(id: string): Promise<void> {
  await apiClient.delete(`/records/${id}`);
}
