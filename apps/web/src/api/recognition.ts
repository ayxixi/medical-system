import { isAxiosError } from 'axios';
import { recognitionClient } from './client';

async function postMedia(path: string, media: Blob, fileName: string, signal?: AbortSignal): Promise<string> {
  const body = new FormData();
  body.append('file', media, fileName);
  try {
    const { data } = await recognitionClient.post<{ text: string }>(`/recognition/${path}`, body, {
      signal,
      timeout: 240_000,
    });
    return data.text;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw new Error('登录已失效。请先复制尚未保存的内容，再退出并重新登录。');
    }
    throw error;
  }
}

export function recognizeImage(file: File, signal?: AbortSignal): Promise<string> {
  return postMedia('ocr', file, file.name || 'image', signal);
}

export function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  return postMedia('transcribe', blob, `recording.${extension}`, signal);
}
