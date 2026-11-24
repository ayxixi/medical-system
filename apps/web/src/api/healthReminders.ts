import { apiClient } from './client';

export type HealthReminderKind = 'temperature' | 'medication' | 'custom';
export type HealthReminderAction = 'complete' | 'snooze';

export interface HealthReminder {
  id: string;
  userId: string;
  visitId: string | null;
  kind: HealthReminderKind;
  title: string;
  note: string | null;
  nextAt: string;
  localTime: string | null;
  timeZone: string;
  repeatDaily: boolean;
  snoozedUntil: string | null;
  isActive: boolean;
  completedAt: string | null;
}

export interface HealthReminderPayload {
  userId: string;
  visitId?: string;
  kind: HealthReminderKind;
  title: string;
  note?: string | null;
  nextAt: string;
  localTime?: string | null;
  timeZone: string;
  repeatDaily: boolean;
}

export async function listHealthReminders(params: {
  userId: string;
  visitId?: string;
  includeInactive?: boolean;
}): Promise<HealthReminder[]> {
  const { data } = await apiClient.get<HealthReminder[]>('/health-reminders', { params });
  return data;
}

export async function createHealthReminder(payload: HealthReminderPayload): Promise<HealthReminder> {
  const { data } = await apiClient.post<HealthReminder>('/health-reminders', payload);
  return data;
}

export async function updateHealthReminder(
  id: string,
  payload: Partial<HealthReminderPayload> & { isActive?: boolean },
): Promise<HealthReminder> {
  const { data } = await apiClient.patch<HealthReminder>(`/health-reminders/${id}`, payload);
  return data;
}

export async function actOnHealthReminder(
  id: string,
  action: HealthReminderAction,
): Promise<HealthReminder> {
  const { data } = await apiClient.post<HealthReminder>(`/health-reminders/${id}/action`, { action });
  return data;
}

export async function deleteHealthReminder(id: string): Promise<void> {
  await apiClient.delete(`/health-reminders/${id}`);
}
