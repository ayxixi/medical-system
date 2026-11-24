import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { App, Button, Modal, Slider, Space } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { extractErrorMessage } from '@/api/client';

const maxSize = 10 * 1024 * 1024;
const maxPages = 12;
const imageTypes = 'image/jpeg,image/png,image/webp';

type Crop = Record<'top' | 'right' | 'bottom' | 'left', number>;
const fullPage: Crop = { top: 0, right: 0, bottom: 0, left: 0 };
const cropEdges = [['top', '上边'], ['right', '右边'], ['bottom', '下边'], ['left', '左边']] as const;

interface ScanPage {
  id: number;
  file: File;
  rotation: number;
  crop: Crop;
}

async function renderPage(page: ScanPage, maxDimension = 2200) {
  const bitmap = await createImageBitmap(page.file);
  try {
    const { top, right, bottom, left } = page.crop;
    const x = bitmap.width * left / 100;
    const y = bitmap.height * top / 100;
    const sourceWidth = bitmap.width * (100 - left - right) / 100;
    const sourceHeight = bitmap.height * (100 - top - bottom) / 100;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const quarterTurn = page.rotation % 180 !== 0;
    const canvas = document.createElement('canvas');
    canvas.width = quarterTurn ? height : width;
    canvas.height = quarterTurn ? width : height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法生成扫描件');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(page.rotation * Math.PI / 180);
    context.drawImage(bitmap, x, y, sourceWidth, sourceHeight, -width / 2, -height / 2, width, height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

async function pagesToPdf(pages: ScanPage[]) {
  const { jsPDF } = await import('jspdf');
  let pdf: InstanceType<typeof jsPDF> | undefined;
  for (const [index, page] of pages.entries()) {
    let canvas: HTMLCanvasElement;
    try {
      canvas = await renderPage(page);
    } catch {
      throw new Error(`第 ${index + 1} 页无法读取，请替换为 JPG、PNG 或 WebP 图片`);
    }
    const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
    if (pdf) pdf.addPage('a4', orientation);
    else pdf = new jsPDF({ format: 'a4', orientation });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const fit = Math.min((width - 16) / canvas.width, (height - 16) / canvas.height);
    const imageWidth = canvas.width * fit;
    const imageHeight = canvas.height * fit;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.82), 'JPEG',
      (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight, String(page.id));
    canvas.width = 0;
    canvas.height = 0;
  }
  if (!pdf) throw new Error('请先添加图片');
  const name = pages[0].file.name.replace(/\.[^.]+$/, '') || '文档';
  return new File([pdf.output('blob')], `${name}-扫描件.pdf`, { type: 'application/pdf' });
}

function PagePreview({ page, index }: { page: ScanPage; index: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    void renderPage(page, 180).then((canvas) => {
      if (active) setUrl(canvas.toDataURL('image/jpeg'));
    }).catch(() => { if (active) setUrl(''); });
    return () => { active = false; };
  }, [page]);
  return <div className="scan-page-preview">
    {url ? <img src={url} alt={`第 ${index + 1} 页预览`} /> : <span>图片预览</span>}
  </div>;
}

function CropEditor({ page, onApply, onCancel }: { page: ScanPage; onApply: (crop: Crop) => void; onCancel: () => void }) {
  const [url, setUrl] = useState('');
  const [crop, setCrop] = useState(page.crop);
  useEffect(() => {
    const imageUrl = URL.createObjectURL(page.file);
    setUrl(imageUrl);
    return () => URL.revokeObjectURL(imageUrl);
  }, [page.file]);
  return <div className="scan-crop-editor">
    <p>拖动滑块调整原图四边，框内为保留区域。旋转在裁边后应用。</p>
    {url && <div className="scan-crop-picture">
      <img src={url} alt="裁边前的原图" />
      <div aria-hidden="true" className="scan-crop-outline"
        style={{ inset: `${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%` }} />
    </div>}
    {cropEdges.map(([edge, label]) => {
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
      return <div key={edge} className="scan-crop-control">
        <span>{label} {crop[edge]}%</span>
        <Slider ariaLabelForHandle={label} value={crop[edge]} min={0} max={90 - crop[opposite[edge]]}
          onChange={(value) => setCrop({ ...crop, [edge]: value })} />
      </div>;
    })}
    <Space wrap>
      <Button onClick={() => setCrop(fullPage)}>恢复原图</Button>
      <Button onClick={onCancel}>取消裁边</Button>
      <Button type="primary" onClick={() => onApply(crop)}>应用裁边</Button>
    </Space>
  </div>;
}

export function AttachmentScan({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [cropId, setCropId] = useState<number>();
  const editingPage = pages.find((page) => page.id === cropId);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  function addPages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    if (pages.length + files.length > maxPages) {
      message.error(`每个扫描件最多 ${maxPages} 页`);
      return;
    }
    if (files.some((file) => file.size > maxSize)) {
      message.error('单张图片不能超过 10 MB');
      return;
    }
    setPages([...pages, ...files.map((file) => ({ file, id: nextId.current++, rotation: 0, crop: fullPage }))]);
  }

  function move(index: number, offset: number) {
    const reordered = [...pages];
    const [page] = reordered.splice(index, 1);
    reordered.splice(index + offset, 0, page);
    setPages(reordered);
  }

  async function upload() {
    if (busy || !pages.length || editingPage) return;
    setBusy(true);
    try {
      const pdf = await pagesToPdf(pages);
      if (pdf.size > maxSize) throw new Error('扫描 PDF 超过 10 MB，请减少页数后重试');
      await onUpload(pdf);
      setPages([]);
      setOpen(false);
      message.success('扫描 PDF 已添加');
    } catch (error) {
      message.error(extractErrorMessage(error, '无法生成或上传扫描 PDF'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="small" icon={<CameraOutlined />} onClick={() => setOpen(true)}>生成扫描 PDF</Button>
      <input ref={input} hidden type="file" accept={imageTypes} multiple onChange={addPages} />
      <input ref={camera} hidden type="file" accept={imageTypes} capture="environment" onChange={addPages} />
      <Modal className="responsive-modal" title="生成扫描 PDF" open={open} confirmLoading={busy}
        okText="生成并上传" cancelText="关闭" okButtonProps={{ disabled: !pages.length || Boolean(editingPage) }}
        onOk={() => void upload()} onCancel={() => { if (!busy) { setCropId(undefined); setOpen(false); } }} maskClosable={false}>
        {editingPage ? (
          <CropEditor key={editingPage.id} page={editingPage} onCancel={() => setCropId(undefined)} onApply={(crop) => {
            setPages(pages.map((page) => page.id === editingPage.id ? { ...page, crop } : page));
            setCropId(undefined);
          }} />
        ) : <>
        <Space wrap>
          <Button disabled={busy || pages.length >= maxPages} onClick={() => input.current?.click()}>选取图片</Button>
          <Button disabled={busy || pages.length >= maxPages} onClick={() => camera.current?.click()}>拍照添加</Button>
          <span>{pages.length} / {maxPages} 页</span>
        </Space>
        <div className="scan-page-list">
          {pages.map((page, index) => <div className="scan-page-item" key={page.id}>
            <PagePreview page={page} index={index} />
            <div>
              <div>第 {index + 1} 页 · {page.file.name}</div>
              <Space wrap>
                <Button size="small" disabled={busy || index === 0} onClick={() => move(index, -1)}>上移</Button>
                <Button size="small" disabled={busy || index === pages.length - 1} onClick={() => move(index, 1)}>下移</Button>
                <Button size="small" disabled={busy} onClick={() => setPages(pages.map((entry) => entry.id === page.id
                  ? { ...entry, rotation: (entry.rotation + 90) % 360 } : entry))}>旋转</Button>
                <Button size="small" disabled={busy} onClick={() => setCropId(page.id)}>裁边</Button>
                <Button size="small" danger disabled={busy} onClick={() => setPages(pages.filter((entry) => entry.id !== page.id))}>移除</Button>
              </Space>
            </div>
          </div>)}
        </div>
        </>}
      </Modal>
    </>
  );
}
