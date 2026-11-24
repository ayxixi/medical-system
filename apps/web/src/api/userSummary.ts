import { apiClient } from './client';

export interface UserHealthSummary {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    visits: number;
    healthLogs: number;
    reminders: number;
  };
  visits: Array<{
    id: string;
    date: string;
    hospital: string | null;
    department: string | null;
    records: Array<{ id: string; diagnosis: string }>;
    medications: Array<{ id: string; name: string; dosage: string | null; frequency: string | null }>;
  }>;
  healthLogs: Array<{
    id: string;
    type: string;
    occurredAt: string;
    temperature: number | null;
    medicineName: string | null;
    dosage: string | null;
    symptoms: string | null;
    note: string | null;
  }>;
  reminders: Array<{
    id: string;
    kind: string;
    title: string;
    nextAt: string;
    localTime: string | null;
    timeZone: string;
    repeatDaily: boolean;
  }>;
}

export async function getUserHealthSummary(id: string): Promise<UserHealthSummary> {
  const { data } = await apiClient.get<UserHealthSummary>(`/users/${id}/summary`);
  return data;
}
