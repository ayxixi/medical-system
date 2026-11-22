import type { Readable } from 'node:stream';

export type SaveFileInput = {
  buffer: Buffer;
  relativePath: string;
  mimeType: string;
};

export type StoredFileDescriptor = {
  storedName: string;
  relativePath: string;
};

export interface FileStorageService {
  save(input: SaveFileInput): Promise<void>;
  read(relativePath: string): Promise<Readable | null>;
  delete(relativePath: string): Promise<void>;
}

export const FILE_STORAGE_SERVICE = Symbol('FILE_STORAGE_SERVICE');
