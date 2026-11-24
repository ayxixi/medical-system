import { isAxiosError } from 'axios';
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

export async function readFile(id: string, signal?: AbortSignal): Promise<Blob> {
  try {
    const { data } = await apiClient.get<Blob>(`/files/${id}/content`, { responseType: 'blob', signal });
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new Error('附件原件不存在或已不可访问');
    }
    throw error;
  }
}
