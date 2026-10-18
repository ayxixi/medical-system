import { apiClient } from './client';
import type { VisitFile } from './visits';

export async function listFilesByVisit(visitId: string): Promise<VisitFile[]> {
  const { data } = await apiClient.get<VisitFile[]>(`/visits/${visitId}/files`);
  return data;
}

export async function uploadFile(visitId: string, file: File): Promise<VisitFile> {
  const formData = new FormData();
  formData.append('visitId', visitId);
  formData.append('file', file);
  const { data } = await apiClient.post<VisitFile>('/files/upload', formData);
  return data;
}

export async function replaceFile(id: string, file: File): Promise<VisitFile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.put<VisitFile>(`/files/${id}`, formData);
  return data;
}

export async function deleteFile(id: string): Promise<void> {
  await apiClient.delete(`/files/${id}`);
}
