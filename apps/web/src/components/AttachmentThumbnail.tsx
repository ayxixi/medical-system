import { useEffect, useRef, useState } from 'react';
import { FileOutlined } from '@ant-design/icons';
import { Popover } from 'antd';
import { readFile } from '@/api/files';
import type { VisitFile } from '@/api/visits';

const images = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function pdfThumbnail(blob: Blob) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loading = pdfjs.getDocument({ data: await blob.arrayBuffer(), isEvalSupported: false });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 320 / Math.max(original.width, original.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) return undefined;
    await page.render({ canvasContext, viewport }).promise;
    return canvas.toDataURL('image/png');
  } finally {
    await loading.destroy();
  }
}

export function AttachmentThumbnail({ file, onPreview }: { file: VisitFile; onPreview: () => void }) {
  const container = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const load = async () => {
      try {
        const blob = await readFile(file.id, controller.signal);
        if (controller.signal.aborted) return;
        if (images.has(file.mimeType)) {
          objectUrl = URL.createObjectURL(blob.slice(0, blob.size, file.mimeType));
          setUrl(objectUrl);
        } else {
          const thumbnail = await pdfThumbnail(blob);
          if (!controller.signal.aborted) setUrl(thumbnail);
        }
      } catch {
        // Keep the file icon when a thumbnail cannot be generated.
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void load();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.mimeType]);

  if (!images.has(file.mimeType) && file.mimeType !== 'application/pdf') {
    return <span className="file-type-icon"><FileOutlined /></span>;
  }

  return (
    <span ref={container} className="attachment-thumbnail">
      <Popover trigger="hover" mouseEnterDelay={0.35} content={url
        ? <img className="attachment-hover-image" src={url} alt={file.originalName} />
        : '点击打开附件预览'}>
        <button type="button" className="attachment-thumbnail-button" onClick={onPreview}
          aria-label={`预览 ${file.originalName}`}>
          {url ? <img src={url} alt="" /> : <FileOutlined />}
        </button>
      </Popover>
    </span>
  );
}
