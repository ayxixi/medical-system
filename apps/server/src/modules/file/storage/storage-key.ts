import { randomUUID } from 'node:crypto';
import { extname, posix } from 'node:path';
import type { StoredFileDescriptor } from './storage.interface';

export function createStorageKey(
  userId: string,
  visitId: string,
  originalName: string,
): StoredFileDescriptor {
  const extension = extname(originalName).toLowerCase();
  const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
  const storedName = `${randomUUID()}${safeExtension}`;
  const segments = [userId, visitId].map((id) => id.replace(/[^a-zA-Z0-9_-]/g, '_'));
  return { storedName, relativePath: posix.join(...segments, storedName) };
}
