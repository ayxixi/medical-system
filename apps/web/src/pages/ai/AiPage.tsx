import { useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient, extractErrorMessage } from '@/api/client';
import { listHealthLogs } from '@/api/healthLogs';
import { listUsers } from '@/api/users';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/auth';

interface Model {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  endpoint: string;
}

function importMatches(text: string, models: Model[]) {
  const groups = JSON.parse(text);
  if (!Array.isArray(groups)) throw new Error();
  const ids = new Set<string>();
  for (const group of groups) {
    if (group?.vendor !== 'customendpoint' || !Array.isArray(group.models)) continue;
    if (group.apiType && group.apiType !== 'chat-completions') continue;
    for (const entry of group.models) {
      if (typeof entry?.id !== 'string' || typeof entry?.url !== 'string') continue;
      let address: URL;
      try {
        address = new URL(entry.url);
      } catch {
        continue;
      }
      if (address.username || address.password || address.search || address.hash) continue;
      const normalized = address.href.replace(/\/+$/, '');
      const match = models.find((model) => model.model === entry.id
        && (model.baseUrl === normalized || model.endpoint === normalized
          || (address.pathname === '/' && model.baseUrl === `${normalized}/v1`)));
      if (match) ids.add(match.id);
    }
  }
  return [...ids];
}

export default function AiPage() {
  const account = useAuthStore((state) => state.account?.id);
  const preference = `medical-ai-default:${account}`;
  const [modelId, setModelId] = useState(() => localStorage.getItem(preference) ?? '');
  const [drafts, setDrafts] = useState<string[]>([]);
  const [importText, setImportText] = useState('');
  const [question, setQuestion] = useState('');
  const [member, setMember] = useState('');
  const [records, setRecords] = useState<string[]>([]);
  const [submission, setSubmission] = useState<{ model: Model; text: string }>();
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const catalog = useQuery({
    queryKey: ['ai-models', account],
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => (await apiClient.get<Model[]>('/ai/models')).data,
  });
  const users = useQuery({ queryKey: ['ai-members', account], queryFn: listUsers });
  const logs = useQuery({
    queryKey: ['ai-records', account, member],
    queryFn: () => listHealthLogs({ userId: member }),
    enabled: Boolean(member),
  });
  const models = catalog.data ?? [];
  const selected = models.find((model) => model.id === modelId);
  const previewValid = Boolean(submission && selected && !catalog.isError
    && submission.model.id === selected.id && submission.model.model === selected.model
    && submission.model.endpoint === selected.endpoint);
  const selectModel = (id: string) => {
    setModelId(id);
    setSubmission(undefined);
    setAnswer('');
    setFeedback(undefined);
  };

  async function run(request: () => Promise<void>) {
    setBusy(true);
    setFeedback(undefined);
    try {
      await request();
    } catch (error) {
      setFeedback({ error: true, text: extractErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const testModel = (model: Model) => void run(async () => {
    await apiClient.post(`/ai/models/${model.id}/test-draft`,
      { baseUrl: model.endpoint, model: model.model }, { timeout: 32_000 });
    setFeedback({ error: false, text: `${model.name}连接成功` });
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <PageHeader eyebrow="就诊准备" title="AI 问诊" description="整理病程和就诊时想问医生的问题。" />
      <Card title="AI 模型配置">
        <Space direction="vertical" style={{ width: '100%' }}>
          {catalog.isError && <Alert type="error" message={extractErrorMessage(catalog.error)} />}
          {catalog.isSuccess && !models.length && <Alert type="info" message="请先在服务端配置 AI_MODELS_JSON。" />}
          <Select aria-label="模型" placeholder="选择模型" value={selected?.id} disabled={busy}
            style={{ width: '100%' }} onChange={selectModel}
            options={models.map((model) => ({ value: model.id, label: `${model.name} · ${model.model}` }))} />
          {selected && <Typography.Text style={{ overflowWrap: 'anywhere' }}>{selected.endpoint}</Typography.Text>}
          <Space wrap>
            <Button disabled={!selected || busy} onClick={() => {
              localStorage.setItem(preference, modelId);
              setFeedback({ error: false, text: '已保存此浏览器的默认模型' });
            }}>设为此浏览器默认</Button>
            <Button disabled={!selected || busy || catalog.isFetching || catalog.isError}
              onClick={() => { if (selected) testModel(selected); }}>测试连接</Button>
            <Button disabled={busy} loading={catalog.isFetching}
              onClick={() => void catalog.refetch()}>刷新模型</Button>
          </Space>
          <details>
            <summary>导入 Polaris / VS Code 自定义端点</summary>
            <Input.TextArea aria-label="自定义端点 JSON" value={importText} rows={3} maxLength={30000}
              placeholder="粘贴已移除密钥的 JSON" onChange={(event) => setImportText(event.target.value)} />
            <Button disabled={busy || !importText} onClick={() => {
              try {
                const matches = importMatches(importText, models);
                if (!matches.length) throw new Error();
                setDrafts(matches);
                setImportText('');
                setFeedback({ error: false, text: '已读取与服务端配置匹配的草稿，请选择使用的模型。' });
              } catch {
                setFeedback({ error: true, text: '未找到匹配服务端模型和地址的 Chat Completions 配置。' });
              }
            }}>导入草稿</Button>
            <Space wrap>
              {models.filter((model) => drafts.includes(model.id)).map((model) => (
                <Space wrap key={model.id}>
                  <Typography.Text>{model.name}</Typography.Text>
                  <Button disabled={busy || catalog.isFetching || catalog.isError} onClick={() => testModel(model)}>测试草稿</Button>
                  <Button disabled={busy || catalog.isFetching || catalog.isError} onClick={() => selectModel(model.id)}>使用草稿</Button>
                </Space>
              ))}
            </Space>
          </details>
        </Space>
      </Card>
      <Card title="准备问题">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea aria-label="想咨询的问题" placeholder="填写症状或想咨询的问题" value={question}
            rows={4} maxLength={4000} style={{ fontSize: 16 }} disabled={busy} onChange={(event) => {
              setQuestion(event.target.value);
              setSubmission(undefined);
            }} />
          <Select aria-label="选择记录对象" placeholder="可选：选择家庭成员，附上部分病程记录"
            value={member || undefined} allowClear disabled={busy} style={{ width: '100%' }}
            options={(users.data ?? []).map((user) => ({ value: user.id, label: user.name }))}
            onChange={(id) => { setMember(id ?? ''); setRecords([]); setSubmission(undefined); }} />
          {member && logs.isError && <Alert type="error" message={extractErrorMessage(logs.error)} />}
          {member && logs.data && <Select mode="multiple" aria-label="选择发送的病程记录"
            placeholder="选择要附上的记录，最多 5 条" value={records} maxCount={5} disabled={busy}
            style={{ width: '100%' }} onChange={(ids) => { setRecords(ids); setSubmission(undefined); }}
            options={logs.data.slice(0, 50).map((log) => ({
              value: log.id,
              label: `${new Date(log.occurredAt).toLocaleString()} ${[log.temperature == null ? '' : `${log.temperature}°C`, log.medicineName, log.symptoms, log.note].filter(Boolean).join(' ').slice(0, 70)}`,
            }))} />}
          <Button disabled={!selected || !question.trim() || busy || catalog.isFetching || catalog.isError} onClick={() => {
            if (!selected) return;
            const context = (logs.data ?? []).filter((log) => records.includes(log.id)).map((log) =>
              [new Date(log.occurredAt).toLocaleString(), log.temperature == null ? '' : `${log.temperature}°C`,
                log.medicineName, log.dosage, log.symptoms, log.note].filter(Boolean).join(' ').slice(0, 650));
            setSubmission({ model: selected, text: [question.trim(), ...context].join('\n') });
          }}>预览将发送的内容</Button>
          {submission && !previewValid && <Alert type="warning" message="模型已变更，请重新选择模型并预览发送内容。" />}
          {submission && previewValid && <>
            <Alert message={`将发送至 ${submission.model.name} · ${submission.model.model}（${submission.model.endpoint}）`} />
            <Input.TextArea aria-label="发送内容" value={submission.text} rows={6} maxLength={8000} style={{ fontSize: 16 }}
              disabled={busy} onChange={(event) => setSubmission({ ...submission, text: event.target.value })} />
            <Button type="primary" loading={busy} disabled={!submission.text.trim() || catalog.isFetching} onClick={() => void run(async () => {
              setAnswer('');
              const { data } = await apiClient.post<{ answer: string }>(
                `/ai/models/${submission.model.id}/consult`, { text: submission.text, baseUrl: submission.model.endpoint, model: submission.model.model }, { timeout: 32_000 });
              setAnswer(data.answer);
            })}>确认发送</Button>
          </>}
          {feedback && <Alert type={feedback.error ? 'error' : 'success'} message={feedback.text} />}
          {answer && <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{answer}</Typography.Paragraph>}
        </Space>
      </Card>
    </Space>
  );
}
