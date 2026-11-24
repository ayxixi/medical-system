import { readFile } from '@/api/files';
import type { VisitFile } from '@/api/visits';

export const maxPackageBytes = 50 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .trim().replace(/[. ]+$/, '').slice(0, 120) || '附件';
}

export async function exportVisitPackage(
  summary: string, files: VisitFile[], signal: AbortSignal, onProgress: (count: number) => void,
) {
  const { strToU8, zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = { '就诊摘要.txt': strToU8(`\uFEFF${summary}`) };
  let bytes = entries['就诊摘要.txt'].byteLength;
  if (bytes + files.reduce((total, file) => total + file.size, 0) > maxPackageBytes) {
    throw new Error('资料包超过 50 MB，请减少勾选的附件');
  }
  for (const [index, file] of files.entries()) {
    signal.throwIfAborted();
    let blob: Blob;
    try {
      blob = await readFile(file.id, signal);
    } catch {
      signal.throwIfAborted();
      throw new Error(`无法读取「${file.originalName}」，请重试或取消勾选该附件`);
    }
    bytes += blob.size;
    if (bytes > maxPackageBytes) throw new Error('资料包超过 50 MB，请减少勾选的附件');
    entries[`检查附件/${index + 1}-${safeName(file.originalName)}`] = new Uint8Array(await blob.arrayBuffer());
    onProgress(index + 1);
  }
  signal.throwIfAborted();
  // The originals are usually already compressed. Store them without recompression.
  return new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' });
}
