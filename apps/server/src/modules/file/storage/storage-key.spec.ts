import { createStorageKey } from './storage-key';

describe('createStorageKey', () => {
  it('creates a random path using sanitized identifiers and a safe lowercase extension', () => {
    const first = createStorageKey('../user', 'visit/1', 'scan.PNG');
    const second = createStorageKey('../user', 'visit/1', 'scan.PNG');
    expect(first.relativePath).toMatch(/^___user\/visit_1\/[0-9a-f-]{36}\.png$/);
    expect(first.storedName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(second.relativePath).not.toBe(first.relativePath);
  });

  it.each(['file.we!rd', 'file.verylongextension', 'file.abcdefghijklmnopqrstuvwxyz'])('drops unsafe extension from %s', (name) => {
    expect(createStorageKey('u', 'v', name).storedName).toMatch(/^[0-9a-f-]{36}$/);
  });
});
