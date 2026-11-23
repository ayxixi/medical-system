import { apiClient } from './client';

export type HealthLogType = 'temperature' | 'medication' | 'symptom' | 'note';

export interface HealthLog {
  id: string;
  userId: string;
  type: HealthLogType;
  occurredAt: string;
  temperature?: number | null;
  medicineName?: string | null;
  dosage?: string | null;
  symptoms?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthLogPayload {
  userId?: string;
  type: HealthLogType;
  occurredAt: string;
  temperature?: number | null;
  medicineName?: string | null;
  dosage?: string | null;
  symptoms?: string | null;
  note?: string | null;
}

export async function listHealthLogs(params: {
  userId: string;
  from?: string;
}): Promise<HealthLog[]> {
  const { data } = await apiClient.get<HealthLog[]>('/health-logs', { params });
  return data;
}

export async function createHealthLog(payload: HealthLogPayload): Promise<HealthLog> {
  const { data } = await apiClient.post<HealthLog>('/health-logs', payload);
  return data;
}

export async function updateHealthLog(id: string, payload: HealthLogPayload): Promise<HealthLog> {
  const { data } = await apiClient.patch<HealthLog>(`/health-logs/${id}`, payload);
  return data;
}

export async function deleteHealthLog(id: string): Promise<void> {
  await apiClient.delete(`/health-logs/${id}`);
}
