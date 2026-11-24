import { useRef, useState } from 'react';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { apiClient, extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';

export default function DataExportPage() {
  const controller = useRef<AbortController>();
  const [busy, setBusy] = useState(false);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [error, setError] = useState('');

  async function downloadArchive() {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setDownloadedBytes(0);
    setError('');
    try {
      const { data } = await apiClient.get<Blob>('/export/archive', {
        responseType: 'blob',
        signal: current.signal,
        timeout: 0,
        onDownloadProgress: (event) => setDownloadedBytes(event.loaded),
      });
      if (current.signal.aborted) return;
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `电子病历完整备份-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (cause) {
      if (!current.signal.aborted) setError(extractErrorMessage(cause, '导出失败，请检查附件原件后重试'));
    } finally {
      controller.current = undefined;
      setBusy(false);
      setDownloadedBytes(0);
    }
  }

  return <section>
    <PageHeader title="数据导出" description="下载当前账号的病历数据和附件原件，便于个人备份或迁移。" />
    <Card title="完整备份">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph>
          ZIP 文件包含版本化的 data.json、家庭成员、就诊、诊断、用药、病程、提醒、原始附件和 SHA-256 校验清单。附件会按成员和就诊记录归档。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          下载后可在仓库目录运行 <Typography.Text code>python scripts/verify_export_manifest.py 备份文件.zip</Typography.Text> 校验文件完整性。该校验用于发现损坏，不验证备份来源。
        </Typography.Paragraph>
        <Alert type="warning" showIcon message="备份文件包含敏感健康信息，请保存在安全位置，不要公开分享。" />
        {error && <Alert type="error" showIcon message={error} />}
        {busy && <Typography.Text role="status">正在打包并下载，已接收 {(downloadedBytes / 1024 / 1024).toFixed(1)} MB。</Typography.Text>}
        <Space wrap>
          <Button type="primary" icon={<DownloadOutlined />} loading={busy} onClick={() => void downloadArchive()}>
            下载完整 ZIP 备份
          </Button>
          {busy && <Button onClick={() => controller.current?.abort()}>取消</Button>}
        </Space>
      </Space>
    </Card>
  </section>;
}
