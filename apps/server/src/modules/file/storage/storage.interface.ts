import type { Readable } from 'node:stream';

export type SaveFileInput = {
  buffer: Buffer;
  userId: string;
  visitId: string;
  originalName: string;
  mimeType: string;
};

export type StoredFileDescriptor = {
  storedName: string;
  relativePath: string;
};

export interface FileStorageService {
  save(input: SaveFileInput): Promise<StoredFileDescriptor>;
  read(relativePath: string): Promise<Readable | null>;
  delete(relativePath: string): Promise<void>;
}

export const FILE_STORAGE_SERVICE = Symbol('FILE_STORAGE_SERVICE');
