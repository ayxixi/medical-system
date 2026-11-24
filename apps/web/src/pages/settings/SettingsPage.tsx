import { useState } from 'react';
import { Alert, Button, Card, Checkbox, Input, Popconfirm, Space, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/auth';

interface Draft {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  exactEndpoint: boolean;
  enabled: boolean;
  isDefault: boolean;
}

interface SavedModel extends Draft {
  approved: boolean;
  endpoint: string;
}

function draftId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function asDraft({ id, name, model, baseUrl, exactEndpoint, enabled, isDefault }: Draft): Draft {
  return { id, name, model, baseUrl, exactEndpoint, enabled, isDefault };
}

function parseImport(text: string): Draft[] {
  const items = JSON.parse(text);
  if (!Array.isArray(items)) throw new Error('请输入 JSON 数组');
  const drafts: Draft[] = [];
  for (const item of items) {
    if (item?.vendor && (item.vendor !== 'customendpoint' || (item.apiType && item.apiType !== 'chat-completions'))) continue;
    const entries = Array.isArray(item?.models) ? item.models : [item];
    for (const entry of entries) {
      const model = entry?.model ?? entry?.id;
      const rawUrl = entry?.baseUrl ?? entry?.base_url ?? entry?.url;
      if (typeof model !== 'string' || !model.trim() || typeof rawUrl !== 'string') continue;
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        throw new Error(`模型 ${model} 的地址格式无效`);
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error(`模型 ${model} 的地址必须是 HTTP/HTTPS，且不能含凭据、查询或片段`);
      }
      const exactEndpoint = entry.exactEndpoint === true || entry.exact_endpoint === true
        || url.pathname.replace(/\/+$/, '').endsWith('/chat/completions');
      if (url.pathname === '/' && !exactEndpoint && Array.isArray(item?.models)) url.pathname = '/v1';
      drafts.push({
        id: draftId(), name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : model.trim(),
        model: model.trim(), baseUrl: url.href.replace(/\/+$/, ''), exactEndpoint, enabled: false, isDefault: false,
      });
    }
  }
  if (!drafts.length) throw new Error('未找到包含模型 ID 和 API 地址的配置');
  return drafts;
}

export default function SettingsPage() {
  const account = useAuthStore((state) => state.account?.id);
  const client = useQueryClient();
  const saved = useQuery({
    queryKey: ['ai-settings', account],
    queryFn: async () => (await apiClient.get<SavedModel[]>('/ai/models/settings')).data,
  });
  const [edited, setEdited] = useState<Draft[]>();
  const [active, setActive] = useState('');
  const [source, setSource] = useState('');
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; text: string }>();
  const [operation, setOperation] = useState<'save' | 'test'>();
  const pending = Boolean(operation);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string }>();
  const models = edited ?? saved.data ?? [];
  const selected = models.find((model) => model.id === active) ?? models[0];

  function update(values: Partial<Draft>) {
    if (!selected) return;
    setEdited(models.map((entry) => {
      if (entry.id === selected.id) return { ...asDraft(entry), ...values };
      return values.isDefault ? { ...asDraft(entry), isDefault: false } : asDraft(entry);
    }));
  }

  async function run(kind: 'save' | 'test', action: () => Promise<string>) {
    setOperation(kind);
    setFeedback(undefined);
    try {
      setFeedback({ type: 'success', text: await action() });
    } catch (error) {
      setFeedback({ type: 'error', text: `${kind === 'save' ? '保存失败' : '测试失败'}：${extractErrorMessage(error)}` });
    } finally {
      setOperation(undefined);
    }
  }

  return (
    <section>
      <PageHeader eyebrow="电子病历" title="设定" description="管理员可配置供所有账号使用的 AI 问诊模型。" />
      <Card title="AI 模型设置" loading={saved.isPending}>
        {saved.isError ? <Alert type="error" message={extractErrorMessage(saved.error)} action={
          <Button onClick={() => void saved.refetch()}>重试</Button>} /> : <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Button disabled={pending || models.length >= 30} onClick={() => {
              const id = draftId();
              setEdited([...models.map(asDraft), { id, name: '', model: '', baseUrl: '', enabled: false, exactEndpoint: false, isDefault: false }]);
              setActive(id);
            }}>新增模型</Button>
            <Button type="primary" loading={operation === 'save'} disabled={pending || !edited} onClick={() => void run('save', async () => {
              const { data } = await apiClient.put<SavedModel[]>('/ai/models/settings', { models: models.map(asDraft) });
              client.setQueryData(['ai-settings', account], data);
              setEdited(undefined);
              setImportFeedback(undefined);
              void client.invalidateQueries({ queryKey: ['ai-models', account] });
              return '模型设置已保存';
            })}>保存设置</Button>
            {edited && <Tag>有未保存的修改</Tag>}
          </Space>
          {feedback && <Alert showIcon type={feedback.type} message={feedback.text} style={{ marginBottom: 16 }} />}
          <div className="ai-settings-grid">
            <Space direction="vertical" style={{ width: '100%' }}>
              {models.map((entry) => (
                <Button key={entry.id} block disabled={pending} type={selected?.id === entry.id ? 'primary' : 'default'}
                  style={{ whiteSpace: 'normal', height: 'auto', overflowWrap: 'anywhere' }} onClick={() => setActive(entry.id)}>
                  {entry.name || '未命名模型'} · {entry.isDefault ? '默认' : entry.enabled ? '已启用' : '停用'}
                </Button>
              ))}
              {!models.length && <Typography.Text type="secondary">添加或导入一个模型开始配置。</Typography.Text>}
            </Space>
            {selected && <Space direction="vertical" style={{ width: '100%' }}>
              <label>显示名称<Input value={selected.name} maxLength={100} disabled={pending} onChange={(e) => update({ name: e.target.value })} /></label>
              <label>模型 ID<Input value={selected.model} maxLength={180} disabled={pending} onChange={(e) => update({ model: e.target.value })} /></label>
              <label>API 地址<Input value={selected.baseUrl} maxLength={2048} disabled={pending} onChange={(e) => update({ baseUrl: e.target.value })} /></label>
              <Typography.Text type="secondary">使用本机或局域网 IPv4 地址。密钥由部署端配置。</Typography.Text>
              <Checkbox checked={selected.exactEndpoint} disabled={pending} onChange={(e) => update({ exactEndpoint: e.target.checked })}>使用完整请求地址</Checkbox>
              <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
                最终请求地址：{(() => {
                  const address = selected.baseUrl.trim().replace(/\/+$/, '');
                  if (!address) return '请填写 API 地址';
                  return selected.exactEndpoint || address.endsWith('/chat/completions') ? address : `${address}/chat/completions`;
                })()}
              </Typography.Text>
              <Space wrap>
                <Checkbox checked={selected.enabled} disabled={pending} onChange={(e) =>
                  update({ enabled: e.target.checked, ...(e.target.checked ? {} : { isDefault: false }) })}>启用</Checkbox>
                <Checkbox checked={selected.isDefault} disabled={pending || !selected.enabled} onChange={(e) =>
                  update({ isDefault: e.target.checked })}>设为默认</Checkbox>
              </Space>
              <Space wrap>
                <Button loading={operation === 'test'} disabled={pending} onClick={() => void run('test', async () => {
                  await apiClient.post('/ai/models/settings/test', { models: [asDraft(selected)] }, { timeout: 32_000 });
                  return '连接成功';
                })}>测试当前配置</Button>
                <Popconfirm title="从列表移除此模型？" onConfirm={() => setEdited(models.filter((entry) => entry.id !== selected.id).map(asDraft))}>
                  <Button danger disabled={pending}>移除</Button>
                </Popconfirm>
              </Space>
            </Space>}
          </div>
          <details style={{ marginTop: 24 }}>
            <summary>导入自定义端点</summary>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              <Input.TextArea aria-label="自定义端点 JSON" value={source} disabled={pending} rows={4} maxLength={30000}
                placeholder="粘贴模型配置 JSON，导入后可编辑并保存" onChange={(e) => setSource(e.target.value)} />
              <Button disabled={!source.trim() || pending} onClick={() => {
                try {
                  const imported = parseImport(source);
                  if (models.length + imported.length > 30) throw new Error('最多可保存 30 个模型');
                  setEdited([...models.map(asDraft), ...imported]);
                  setActive(imported[0].id);
                  setSource('');
                  setImportFeedback({ type: 'success', text: `已导入 ${imported.length} 个停用草稿，点击「保存设置」后保留` });
                } catch (error) {
                  setImportFeedback({ type: 'error', text: error instanceof SyntaxError ? 'JSON 格式无效，请检查后重试' : extractErrorMessage(error) });
                }
              }}>导入草稿</Button>
              {importFeedback && <Alert showIcon type={importFeedback.type} message={importFeedback.text} />}
            </Space>
          </details>
        </>}
      </Card>
    </section>
  );
}
