import { useAiPermissions } from '@/api/aiPermissions';
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  isDefault?: boolean;
}

export default function AiPage() {
  const { data: permissions } = useAiPermissions();
  const account = useAuthStore((state) => state.account?.id);
  const [modelId, setModelId] = useState('');
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
  const selected = models.find((model) => model.id === modelId)
    ?? models.find((model) => model.isDefault);
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
      <Card title="问诊模型" extra={permissions?.canManage && <Link to="/settings">管理模型</Link>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {catalog.isError && <Alert type="error" message={extractErrorMessage(catalog.error)} />}
          {catalog.isSuccess && !models.length && <Alert type="info" message="暂无已启用的问诊模型，请联系管理员。" />}
          <Select aria-label="模型" placeholder="选择模型" value={selected?.id} disabled={busy}
            style={{ width: '100%' }} onChange={selectModel}
            options={models.map((model) => ({ value: model.id, label: `${model.name} · ${model.model}` }))} />
          {selected && <Typography.Text style={{ overflowWrap: 'anywhere' }}>{selected.endpoint}</Typography.Text>}
          <Space wrap>
            <Button disabled={!selected || busy || catalog.isFetching || catalog.isError}
              onClick={() => { if (selected) testModel(selected); }}>测试连接</Button>
            <Button disabled={busy} loading={catalog.isFetching}
              onClick={() => void catalog.refetch()}>刷新模型</Button>
          </Space>
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
