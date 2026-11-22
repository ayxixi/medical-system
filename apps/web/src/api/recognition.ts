import { apiClient } from './client';

async function postMedia(path: string, media: Blob, fileName: string): Promise<string> {
  const body = new FormData();
  body.append('file', media, fileName);
  const { data } = await apiClient.post<{ text: string }>(`/recognition/${path}`, body, {
    timeout: 240_000,
  });
  return data.text;
}

export function recognizeImage(file: File): Promise<string> {
  return postMedia('ocr', file, file.name || 'image');
}

export function transcribeAudio(blob: Blob): Promise<string> {
  const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  return postMedia('transcribe', blob, `recording.${extension}`);
}
