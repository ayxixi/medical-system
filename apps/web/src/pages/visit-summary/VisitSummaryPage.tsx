import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Input, Select, Space, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { listUsers } from '@/api/users';
import { listHealthLogs, type HealthLog } from '@/api/healthLogs';
import { listVisits, type Visit } from '@/api/visits';
import { apiClient, extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/auth';
import { exportVisitPackage, maxPackageBytes } from './exportVisitPackage';

const stamp = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');
const types = { temperature: '体温', medication: '服药', symptom: '症状', note: '日常' };
const summaryHeadings = new Set(['体温概况', '病程时间线', '就诊记录']);
const maxAiSummaryInput = 8000;

interface AiSummaryModel {
  id: string;
  name: string;
  model: string;
  endpoint: string;
  isDefault?: boolean;
}

function SummaryText({ value }: { value: string }) {
  const blocks = value.split(/\n{2,}/).filter((block) => block.trim());
  return <div className="visit-summary-text">
    {blocks.map((block, index) => {
      const [firstLine, ...rest] = block.split('\n');
      const isHeading = summaryHeadings.has(firstLine.trim());
      return <section className="visit-summary-entry" key={`${index}-${firstLine}`}>
        {isHeading && <h3>{firstLine}</h3>}
        <p>{(isHeading ? rest : [firstLine, ...rest]).join('\n')}</p>
      </section>;
    })}
  </div>;
}

function generateSummary(logs: HealthLog[], visits: Visit[]) {
  const temperatures = logs.filter((log) => log.type === 'temperature' && log.temperature != null);
  const readings = temperatures.map((log) => log.temperature!);
  const logEntries = [...logs].sort((a, b) => dayjs(a.occurredAt).valueOf() - dayjs(b.occurredAt).valueOf())
    .map((log) => [
      `${stamp(log.occurredAt)} · ${types[log.type]}`,
      ...(log.temperature == null ? [] : [`体温：${log.temperature} °C`]),
      ...(log.medicineName ? [`药品：${log.medicineName}`] : []),
      ...(log.dosage ? [`用量：${log.dosage}`] : []),
      ...(log.symptoms ? [`症状：${log.symptoms}`] : []),
      ...(log.note ? [`备注：${log.note}`] : []),
    ].join('\n'));
  const visitEntries = visits.map((visit) => [
    `${dayjs(visit.date).format('YYYY-MM-DD')} · 就诊记录`,
    ...(visit.hospital ? [`医院：${visit.hospital}`] : []),
    ...(visit.department ? [`科室：${visit.department}`] : []),
    ...(visit.doctor ? [`医生：${visit.doctor}`] : []),
    ...(visit.records ?? []).map((record) => `诊断：${record.diagnosis}`),
    ...(visit.medications ?? []).map((medication) =>
      `用药：${[medication.name, medication.dosage, medication.frequency, medication.duration].filter(Boolean).join(' · ')}`),
    ...(visit.note ? [`备注：${visit.note}`] : []),
  ].join('\n'));
  const sections = [
    '体温概况',
    readings.length
      ? `共测量 ${readings.length} 次，最低 ${Math.min(...readings).toFixed(1)} °C，最高 ${Math.max(...readings).toFixed(1)} °C`
      : '所选日期内无体温记录',
    '',
    '病程时间线',
    logEntries.length ? logEntries.join('\n\n') : '所选日期内无病程记录',
    '',
    '就诊记录',
    visitEntries.length ? visitEntries.join('\n\n') : '所选日期内无就诊记录',
  ];
  return sections.join('\n');
}

function buildAiSummaryInput(from: string, to: string, logs: HealthLog[], visits: Visit[]) {
  const lines = [`日期范围：${from} 至 ${to}`, '', '病程记录：'];
  const sortedLogs = [...logs].sort((a, b) => dayjs(a.occurredAt).valueOf() - dayjs(b.occurredAt).valueOf());
  if (!sortedLogs.length) lines.push('无记录');
  for (const log of sortedLogs) {
    lines.push(`时间：${stamp(log.occurredAt)}`, `类型：${types[log.type]}`);
    if (log.temperature != null) lines.push(`体温：${log.temperature} °C`);
    if (log.medicineName) lines.push(`药品：${log.medicineName}`);
    if (log.dosage) lines.push(`用量：${log.dosage}`);
    if (log.symptoms) lines.push(`症状：${log.symptoms}`);
    if (log.note) lines.push(`备注：${log.note}`);
    lines.push('');
  }
  lines.push('就诊记录：');
  if (!visits.length) lines.push('无记录');
  for (const visit of visits) {
    lines.push(`日期：${stamp(visit.date)}`);
    if (visit.hospital) lines.push(`医院：${visit.hospital}`);
    if (visit.department) lines.push(`科室：${visit.department}`);
    if (visit.doctor) lines.push(`医生：${visit.doctor}`);
    for (const record of visit.records ?? []) lines.push(`诊断记录：${record.diagnosis}`);
    for (const medication of visit.medications ?? []) {
      lines.push(`就诊用药：${[medication.name, medication.dosage, medication.frequency, medication.duration].filter(Boolean).join(' · ')}`);
    }
    if (visit.note) lines.push(`备注：${visit.note}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function SummaryPreview({ name, from, to, logs, visits }: {
  name: string; from: string; to: string; logs: HealthLog[]; visits: Visit[];
}) {
  const [edited, setEdited] = useState<string>();
  const [checked, setChecked] = useState<string[]>([]);
  const attachments = visits.flatMap((visit) => (visit.files ?? []).map((file) => ({ file, date: visit.date })));
  const summary = edited ?? generateSummary(logs, visits);
  const chosen = attachments.filter(({ file }) => checked.includes(file.id));
  const selectedBytes = chosen.reduce((total, { file }) => total + file.size, 0);
  const controller = useRef<AbortController>();
  const [progress, setProgress] = useState<number>();
  const [exportError, setExportError] = useState('');
  useEffect(() => () => controller.current?.abort(), []);
  const account = useAuthStore((state) => state.account?.id);
  const aiModels = useQuery({
    queryKey: ['ai-models', account],
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => (await apiClient.get<AiSummaryModel[]>('/ai/models')).data,
  });
  const [aiModelId, setAiModelId] = useState('');
  const [aiSubmission, setAiSubmission] = useState<{ model: AiSummaryModel; text: string }>();
  const [aiDraft, setAiDraft] = useState('');
  const [aiFeedback, setAiFeedback] = useState<{ error: boolean; text: string }>();
  const [aiBusy, setAiBusy] = useState(false);
  const aiModel = aiModels.data?.find((model) => model.id === aiModelId)
    ?? aiModels.data?.find((model) => model.isDefault) ?? aiModels.data?.[0];
  const aiPreviewValid = Boolean(aiSubmission && aiModel && !aiModels.isError
    && aiSubmission.model.id === aiModel.id && aiSubmission.model.model === aiModel.model
    && aiSubmission.model.endpoint === aiModel.endpoint);

  function previewAiSummary() {
    setAiFeedback(undefined);
    setAiDraft('');
    if (!aiModel) return;
    if (!logs.length && !visits.length) {
      setAiSubmission(undefined);
      setAiFeedback({ error: true, text: '当前日期范围没有病程或就诊记录。' });
      return;
    }
    const text = buildAiSummaryInput(from, to, logs, visits);
    if (text.length > maxAiSummaryInput) {
      setAiSubmission(undefined);
      setAiFeedback({ error: true, text: '当前日期范围的记录超过 8000 字，请缩短日期范围后再生成。系统不会截断记录。' });
      return;
    }
    setAiSubmission({ model: aiModel, text });
  }

  async function requestAiSummary() {
    if (!aiSubmission || !aiPreviewValid) return;
    setAiBusy(true);
    setAiFeedback(undefined);
    setAiDraft('');
    try {
      const { data } = await apiClient.post<{ summary: string }>(
        `/ai/models/${aiSubmission.model.id}/summarize`,
        { text: aiSubmission.text, baseUrl: aiSubmission.model.endpoint, model: aiSubmission.model.model },
        { timeout: 32_000 },
      );
      setAiDraft(data.summary);
      setAiFeedback({ error: false, text: '摘要已生成，请核对并编辑；它仍是当前页面草稿。' });
    } catch (error) {
      setAiFeedback({ error: true, text: extractErrorMessage(error, '摘要生成失败') });
    } finally {
      setAiBusy(false);
    }
  }

  async function downloadPackage() {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setProgress(0);
    setExportError('');
    const attachmentList = chosen.map(({ file, date }) => `${dayjs(date).format('YYYY-MM-DD')} · ${file.originalName}`);
    const contents = ['就诊资料包', `${name} · ${from} 至 ${to}`, '', summary,
      ...(attachmentList.length ? ['', '检查附件清单', ...attachmentList] : [])].join('\n');
    try {
      const zip = await exportVisitPackage(contents, chosen.map(({ file }) => file), current.signal, setProgress);
      if (current.signal.aborted) return;
      const url = URL.createObjectURL(zip);
      const link = document.createElement('a');
      link.href = url;
      link.download = `就诊资料包-${from}-${to}.zip`;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (error) {
      if (!current.signal.aborted) setExportError(extractErrorMessage(error, '资料包导出失败'));
    } finally {
      controller.current = undefined;
      if (!current.signal.aborted) setProgress(undefined);
    }
  }

  return <>
    <Card className="visit-summary-controls" title="编辑摘要">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.TextArea aria-label="摘要内容" value={summary} autoSize={{ minRows: 5, maxRows: 13 }}
          style={{ fontSize: 16 }} disabled={progress !== undefined} onChange={(event) => setEdited(event.target.value)} />
        {edited !== undefined && <Button disabled={progress !== undefined} onClick={() => setEdited(undefined)}>恢复自动摘要</Button>}
        <details className="visit-summary-ai">
          <summary>使用本机或局域网 AI 生成摘要</summary>
          <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
            <Alert type="info" showIcon message="仅发送当前成员所选日期范围内的病程与就诊文字，不包含附件。发送前会显示完整内容和模型地址；本系统不会保存生成历史。请核对 AI 摘要后再使用。" />
            {aiModels.isError && <Alert type="error" message={extractErrorMessage(aiModels.error)} />}
            {aiModels.isSuccess && !aiModels.data.length && <Alert type="warning" message="没有可用的本机或局域网模型，请联系管理员配置。" />}
            <label>摘要模型<Select aria-label="摘要模型" value={aiModel?.id} disabled={aiBusy || aiModels.isFetching}
              style={{ width: '100%' }} onChange={(id) => {
                setAiModelId(id);
                setAiSubmission(undefined);
                setAiDraft('');
                setAiFeedback(undefined);
              }} options={(aiModels.data ?? []).map((model) => ({ label: `${model.name} · ${model.model}`, value: model.id }))} /></label>
            {aiModel && <span style={{ overflowWrap: 'anywhere' }}>模型地址：{aiModel.endpoint}</span>}
            <Space wrap>
              <Button disabled={!aiModel || aiBusy || aiModels.isFetching || aiModels.isError}
                onClick={previewAiSummary}>预览将发送的记录</Button>
              <Button loading={aiModels.isFetching} disabled={aiBusy} onClick={() => void aiModels.refetch()}>刷新模型</Button>
            </Space>
            {aiSubmission && !aiPreviewValid && <Alert type="warning" message="模型配置已变化，请刷新模型并重新预览发送内容。" />}
            {aiSubmission && aiPreviewValid && <>
              <Alert message={`将向 ${aiSubmission.model.name} · ${aiSubmission.model.model} 发送以下文字（不含附件）`} />
              <Input.TextArea aria-label="将发送给摘要模型的记录" value={aiSubmission.text} rows={8}
                maxLength={maxAiSummaryInput} showCount disabled={aiBusy} style={{ fontSize: 16 }}
                onChange={(event) => setAiSubmission({ ...aiSubmission, text: event.target.value })} />
              <Button type="primary" loading={aiBusy} disabled={!aiSubmission.text.trim() || aiModels.isFetching}
                onClick={() => void requestAiSummary()}>确认发送并生成摘要</Button>
            </>}
            {aiDraft && <>
              <Input.TextArea aria-label="AI 摘要草稿" value={aiDraft} rows={8} maxLength={8000} showCount
                disabled={aiBusy} style={{ fontSize: 16 }} onChange={(event) => setAiDraft(event.target.value)} />
              <Button disabled={!aiDraft.trim() || aiBusy} onClick={() => {
                setEdited(aiDraft);
                setAiFeedback({ error: false, text: '已应用到上方摘要编辑框，尚未保存到病历。' });
              }}>应用到摘要</Button>
            </>}
            {aiFeedback && <Alert type={aiFeedback.error ? 'error' : 'success'} showIcon message={aiFeedback.text} />}
          </Space>
        </details>
        {attachments.length > 0 && <>
          <strong>选择要导出的附件</strong>
          <Checkbox.Group disabled={progress !== undefined} value={checked} onChange={setChecked}>
            <Space direction="vertical">
              {attachments.map(({ file, date }) => <Checkbox key={file.id} value={file.id}>
                {dayjs(date).format('YYYY-MM-DD')} · {file.originalName}
              </Checkbox>)}
            </Space>
          </Checkbox.Group>
        </>}
        <Space wrap>
          <Button onClick={() => {
            document.documentElement.classList.remove('print-attachments');
            window.print();
          }}>打印摘要</Button>
          {chosen.length > 0 && <Button onClick={() => {
            document.documentElement.classList.add('print-attachments');
            window.print();
          }}>打印附件清单</Button>}
          <Button type="primary" loading={progress !== undefined} disabled={selectedBytes > maxPackageBytes}
            onClick={() => void downloadPackage()}>下载资料包 ZIP</Button>
        </Space>
        <span>ZIP 包含文字摘要和勾选的附件原件。打印版包含摘要和附件清单。</span>
        {selectedBytes > maxPackageBytes && <Alert type="warning" message="已选附件超过 50 MB，请减少勾选数量" />}
        {progress !== undefined && <span role="status">正在打包，已读取 {progress} / {chosen.length} 个附件</span>}
        {exportError && <Alert type="error" message={exportError} />}
      </Space>
    </Card>
    <article className="visit-summary-document" aria-label="就诊资料包预览">
      <h2>就诊资料包</h2>
      <p>{name} · {from} 至 {to}</p>
      <SummaryText value={summary} />
      {chosen.length > 0 && <section className="visit-summary-attachments">
        <h3>检查附件清单</h3>
        <ul>{chosen.map(({ file, date }) => <li key={file.id}>{dayjs(date).format('YYYY-MM-DD')} · {file.originalName}</li>)}</ul>
      </section>}
    </article>
  </>;
}

export default function VisitSummaryPage() {
  const account = useAuthStore((state) => state.account?.id);
  const [searchParams] = useSearchParams();
  const [member, setMember] = useState(() => searchParams.get('member') ?? '');
  const [from, setFrom] = useState(() => dayjs().subtract(6, 'day').format('YYYY-MM-DD'));
  const [to, setTo] = useState(() => dayjs().format('YYYY-MM-DD'));
  const users = useQuery({ queryKey: ['visit-summary-members', account], queryFn: listUsers });
  const selected = users.data?.find((user) => user.id === member) ?? users.data?.[0];
  const validRange = Boolean(from && to && from <= to);
  const data = useQuery({
    queryKey: ['visit-summary', account, selected?.id, from, to],
    enabled: Boolean(selected && validRange),
    queryFn: async () => {
      if (!selected) throw new Error('请选择成员');
      const range = { userId: selected.id, from: dayjs(from).startOf('day').toISOString(), to: dayjs(to).endOf('day').toISOString() };
      const [logs, visits] = await Promise.all([listHealthLogs(range), listVisits({ ...range, order: 'asc' })]);
      return { logs, visits };
    },
  });

  return <section className="visit-summary-page">
    <div className="visit-summary-controls">
      <PageHeader title="就诊资料包" description="按成员和日期整理记录，预览后可保存为 PDF。" />
      <Card>
        <div className="visit-summary-filters">
          <label>家庭成员<Select aria-label="家庭成员" value={selected?.id} onChange={setMember}
            options={(users.data ?? []).map((user) => ({ label: user.name, value: user.id }))} /></label>
          <label>开始日期<Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>结束日期<Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      </Card>
      {users.isError && <Alert type="error" message={extractErrorMessage(users.error)} action={<Button onClick={() => void users.refetch()}>重试</Button>} />}
      {!validRange && <Alert type="warning" message="请选择有效日期范围" />}
      {users.isSuccess && !selected && <Alert type="info" message="请先添加家庭成员" />}
      {data.isError && <Alert type="error" message={extractErrorMessage(data.error)} action={<Button onClick={() => void data.refetch()}>重试</Button>} />}
      {(users.isPending || data.isLoading) && <Spin />}
    </div>
    {selected && validRange && data.data && !data.isError && <SummaryPreview key={JSON.stringify([selected.id, from, to])}
      name={selected.name} from={from} to={to} logs={data.data.logs} visits={data.data.visits} />}
  </section>;
}

if (typeof window !== 'undefined') {
  window.addEventListener('afterprint', () => document.documentElement.classList.remove('print-attachments'));
}
