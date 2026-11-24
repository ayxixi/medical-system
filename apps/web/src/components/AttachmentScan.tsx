import { useRef, useState } from 'react';
import { App, Button } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { extractErrorMessage } from '@/api/client';

const maxSize = 10 * 1024 * 1024;

async function photoToPdf(photo: File) {
  const { jsPDF } = await import('jspdf');
  const bitmap = await createImageBitmap(photo);
  try {
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法生成扫描件');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait' });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const fit = Math.min((width - 16) / canvas.width, (height - 16) / canvas.height);
    const imageWidth = canvas.width * fit;
    const imageHeight = canvas.height * fit;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG',
      (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    return new File([pdf.output('blob')], `${photo.name.replace(/\.[^.]+$/, '') || '文档'}-扫描件.pdf`,
      { type: 'application/pdf' });
  } finally {
    bitmap.close();
  }
}

export function AttachmentScan({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button size="small" icon={<CameraOutlined />} loading={busy}
        onClick={() => input.current?.click()}>生成扫描 PDF</Button>
      <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp"
        onChange={async (event) => {
          const photo = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!photo) return;
          setBusy(true);
          try {
            if (photo.size > maxSize) throw new Error('照片大小不能超过 10 MB');
            const pdf = await photoToPdf(photo);
            if (pdf.size > maxSize) throw new Error('扫描 PDF 大小不能超过 10 MB');
            await onUpload(pdf);
            message.success('扫描 PDF 已添加');
          } catch (error) {
            message.error(extractErrorMessage(error, '无法生成或上传扫描 PDF'));
          } finally {
            setBusy(false);
          }
        }} />
    </>
  );
}
