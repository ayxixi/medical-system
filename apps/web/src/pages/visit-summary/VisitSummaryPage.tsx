import { useState } from 'react';
import { Alert, Button, Card, Checkbox, Input, Select, Space, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { listUsers } from '@/api/users';
import { listHealthLogs, type HealthLog } from '@/api/healthLogs';
import { listVisits, type Visit } from '@/api/visits';
import { extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/auth';

const stamp = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');
const types = { temperature: '体温', medication: '服药', symptom: '症状', note: '日常' };

function generateSummary(logs: HealthLog[], visits: Visit[]) {
  const temperatures = logs.filter((log) => log.type === 'temperature' && log.temperature != null);
  const readings = temperatures.map((log) => log.temperature!);
  const sections = [
    '体温概况',
    readings.length
      ? `共测量 ${readings.length} 次，最低 ${Math.min(...readings).toFixed(1)} °C，最高 ${Math.max(...readings).toFixed(1)} °C`
      : '所选日期内无体温记录',
    '',
    '病程时间线',
    ...[...logs].sort((a, b) => dayjs(a.occurredAt).valueOf() - dayjs(b.occurredAt).valueOf()).map((log) =>
      [stamp(log.occurredAt), types[log.type], log.temperature == null ? '' : `${log.temperature} °C`,
        log.medicineName, log.dosage, log.symptoms, log.note].filter(Boolean).join('　')),
    ...(logs.length ? [] : ['所选日期内无病程记录']),
    '',
    '就诊记录',
    ...visits.flatMap((visit) => [
      [dayjs(visit.date).format('YYYY-MM-DD'), visit.hospital, visit.department, visit.doctor].filter(Boolean).join('　'),
      ...(visit.records ?? []).map((record) => `诊断记录：${record.diagnosis}`),
      ...(visit.medications ?? []).map((medication) =>
        `就诊用药：${[medication.name, medication.dosage, medication.frequency, medication.duration].filter(Boolean).join('　')}`),
      ...(visit.note ? [`备注：${visit.note}`] : []),
    ]),
    ...(visits.length ? [] : ['所选日期内无就诊记录']),
  ];
  return sections.join('\n');
}

function SummaryPreview({ name, from, to, logs, visits }: {
  name: string; from: string; to: string; logs: HealthLog[]; visits: Visit[];
}) {
  const [edited, setEdited] = useState<string>();
  const [checked, setChecked] = useState<string[]>([]);
  const attachments = visits.flatMap((visit) => (visit.files ?? []).map((file) => ({ file, date: visit.date })));
  const summary = edited ?? generateSummary(logs, visits);
  const chosen = attachments.filter(({ file }) => checked.includes(file.id));

  return <>
    <Card className="visit-summary-controls" title="编辑摘要">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.TextArea aria-label="摘要内容" value={summary} autoSize={{ minRows: 5, maxRows: 13 }}
          style={{ fontSize: 16 }} onChange={(event) => setEdited(event.target.value)} />
        {edited !== undefined && <Button onClick={() => setEdited(undefined)}>恢复自动摘要</Button>}
        {attachments.length > 0 && <>
          <strong>纳入附件清单</strong>
          <Checkbox.Group value={checked} onChange={setChecked}>
            <Space direction="vertical">
              {attachments.map(({ file, date }) => <Checkbox key={file.id} value={file.id}>
                {dayjs(date).format('YYYY-MM-DD')} · {file.originalName}
              </Checkbox>)}
            </Space>
          </Checkbox.Group>
        </>}
        <Button type="primary" onClick={() => window.print()}>打印或另存为 PDF</Button>
      </Space>
    </Card>
    <article className="visit-summary-document" aria-label="就诊资料包预览">
      <h2>就诊资料包</h2>
      <p>{name} · {from} 至 {to}</p>
      <div className="visit-summary-text">{summary}</div>
      {chosen.length > 0 && <>
        <h3>检查附件清单</h3>
        <ul>{chosen.map(({ file, date }) => <li key={file.id}>{dayjs(date).format('YYYY-MM-DD')} · {file.originalName}</li>)}</ul>
      </>}
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
