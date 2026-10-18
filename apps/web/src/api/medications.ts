import { apiClient } from './client';
import type { Medication } from './visits';

export async function listMedicationsByVisit(visitId: string): Promise<Medication[]> {
  const { data } = await apiClient.get<Medication[]>(`/visits/${visitId}/medications`);
  return data;
}

export interface CreateMedicationPayload {
  visitId: string;
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export type UpdateMedicationPayload = Partial<Omit<CreateMedicationPayload, 'visitId'>>;

export async function createMedication(payload: CreateMedicationPayload): Promise<Medication> {
  const { data } = await apiClient.post<Medication>('/medications', payload);
  return data;
}

export async function updateMedication(
  id: string,
  payload: UpdateMedicationPayload,
): Promise<Medication> {
  const { data } = await apiClient.patch<Medication>(`/medications/${id}`, payload);
  return data;
}

export async function deleteMedication(id: string): Promise<void> {
  await apiClient.delete(`/medications/${id}`);
}
