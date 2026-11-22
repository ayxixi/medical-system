import { apiClient } from './client';
import type { User } from './users';

export interface DiagnosisRecord {
  id: string;
  visitId: string;
  diagnosis: string;
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  visitId: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisitFile {
  id: string;
  visitId: string;
  originalName: string;
  storedName: string;
  relativePath: string;
  mimeType: string;
  size: number;
  storageProvider: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  userId: string;
  date: string;
  hospital?: string | null;
  department?: string | null;
  doctor?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  records?: DiagnosisRecord[];
  medications?: Medication[];
  files?: VisitFile[];
}

export interface CreateVisitPayload {
  userId: string;
  date: string;
  hospital?: string;
  department?: string;
  doctor?: string;
  note?: string;
}

export interface UpdateVisitPayload {
  date?: string;
  hospital?: string | null;
  department?: string | null;
  doctor?: string | null;
  note?: string | null;
}

export interface ListVisitsQuery {
  userId?: string;
  from?: string;
  to?: string;
  q?: string;
  sortBy?: 'date' | 'createdAt';
  order?: 'asc' | 'desc';
}

export async function listVisits(query: ListVisitsQuery = {}): Promise<Visit[]> {
  const { data } = await apiClient.get<Visit[]>('/visits', { params: query });
  return data;
}

export async function getVisit(id: string): Promise<Visit> {
  const { data } = await apiClient.get<Visit>(`/visits/${id}`);
  return data;
}

export async function createVisit(payload: CreateVisitPayload): Promise<Visit> {
  const { data } = await apiClient.post<Visit>('/visits', payload);
  return data;
}

export async function updateVisit(id: string, payload: UpdateVisitPayload): Promise<Visit> {
  const { data } = await apiClient.patch<Visit>(`/visits/${id}`, payload);
  return data;
}

export async function deleteVisit(id: string): Promise<void> {
  await apiClient.delete(`/visits/${id}`);
}
