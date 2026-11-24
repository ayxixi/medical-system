import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  App as AntdApp,
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FireOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import {
  createHealthLog,
  deleteHealthLog,
  listHealthLogs,
  updateHealthLog,
  type HealthLog,
  type HealthLogPayload,
  type HealthLogType,
} from '@/api/healthLogs';
import { listUsers } from '@/api/users';
import { extractErrorMessage } from '@/api/client';
import { actOnHealthReminder } from '@/api/healthReminders';
import { HealthRemindersPanel } from './HealthRemindersPanel';

interface HealthLogFormValues {
  occurredAt: Dayjs;
  temperature?: number;
  medicineName?: string;
  dosage?: string;
  symptoms?: string[];
  note?: string;
}

function MobileRecordTime({ value, onChange, id }: {
  value?: Dayjs;
  onChange?: (value: Dayjs | undefined) => void;
  id?: string;
}) {
  return (
    <Input
      id={id}
      type="datetime-local"
      value={value?.format('YYYY-MM-DDTHH:mm') ?? ''}
      onChange={(event) => {
        const time = dayjs(event.target.value);
        onChange?.(event.target.value && time.isValid() ? time : undefined);
      }}
    />
  );
}

interface EditorState {
  type: HealthLogType;
  record?: HealthLog;
  reminderId?: string;
}

const rangeOptions = [
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
  { value: '90', label: '最近 90 天' },
  { value: 'all', label: '全部记录' },
];

const symptomOptions = [
  '发热', '咳嗽', '鼻塞', '流鼻涕', '咽喉不适', '头痛', '乏力', '食欲不振', '恶心', '呕吐', '腹痛', '腹泻', '其他',
].map((label) => ({ label, value: label }));
const emptyHealthLogs: HealthLog[] = [];

const logTypes: Record<HealthLogType, { label: string; icon: ReactNode }> = {
  temperature: { label: '体温', icon: <FireOutlined /> },
  medication: { label: '服药', icon: <MedicineBoxOutlined /> },
  symptom: { label: '身体情况', icon: <HeartOutlined /> },
  note: { label: '日常备注', icon: <EditOutlined /> },
};

function splitSymptoms(value?: string | null): string[] {
  return value?.split(/[、，,]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function TemperatureTrend({ logs }: { logs: HealthLog[] }) {
  const measurements = useMemo(
    () => logs
      .filter((log) => log.type === 'temperature' && log.temperature != null)
      .map((log) => ({ id: log.id, time: dayjs(log.occurredAt).valueOf(), value: log.temperature as number }))
      .sort((a, b) => a.time - b.time),
    [logs],
  );

  const values = measurements.map(({ value }) => value);
  const min = values.length ? Math.min(...values) - 0.5 : 35;
  const max = values.length ? Math.max(...values) + 0.5 : 40;
  const start = dayjs().subtract(6, 'day').startOf('day').valueOf();
  const end = dayjs().endOf('day').valueOf();
  const points = measurements.map(({ id, time, value }) => ({
    id,
    x: 12 + ((Math.min(end, Math.max(start, time)) - start) / Math.max(1, end - start)) * 296,
    y: 104 - ((value - min) / Math.max(0.1, max - min)) * 76,
    value,
    time,
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const latest = measurements.at(-1);

  return (
    <Card className="health-trend-card" title="近 7 天体温趋势" extra={<span className="health-unit">摄氏度 °C</span>}>
      {measurements.length ? (
        <>
          <div className="health-temperature-stats">
            <div><span>最近</span><strong>{latest?.value.toFixed(1)}°</strong></div>
            <div><span>最高</span><strong>{Math.max(...values).toFixed(1)}°</strong></div>
            <div><span>最低</span><strong>{Math.min(...values).toFixed(1)}°</strong></div>
          </div>
          <svg className="health-temperature-chart" viewBox="0 0 320 124" role="img" aria-label={`近 7 天记录 ${measurements.length} 次体温`}>
            <line x1="12" y1="28" x2="308" y2="28" className="health-chart-grid" />
            <line x1="12" y1="66" x2="308" y2="66" className="health-chart-grid" />
            <line x1="12" y1="104" x2="308" y2="104" className="health-chart-grid" />
            {points.length > 1 && <path d={path} className="health-chart-line" />}
            {points.map((point) => (
              <circle key={point.id} cx={point.x} cy={point.y} r="4" className="health-chart-point">
                <title>{`${dayjs(point.time).format('M月D日 HH:mm')}：${point.value.toFixed(1)}°C`}</title>
              </circle>
            ))}
          </svg>
          <div className="health-chart-axis"><span>7 天前</span><span>今天</span></div>
        </>
      ) : (
        <div className="health-trend-empty">
          <FireOutlined />
          <span>记录体温后会在这里显示变化趋势</span>
        </div>
      )}
    </Card>
  );
}

function HealthLogDetail({ log }: { log: HealthLog }) {
  if (log.type === 'temperature') {
    return <strong className="health-log-temperature">{log.temperature?.toFixed(1)}°C</strong>;
  }
  if (log.type === 'medication') {
    return <div className="health-log-detail"><strong>{log.medicineName}</strong>{log.dosage && <span>{log.dosage}</span>}</div>;
  }
  if (log.type === 'symptom') {
    return <div className="health-symptom-tags">{splitSymptoms(log.symptoms).map((symptom) => <Tag key={symptom}>{symptom}</Tag>)}</div>;
  }
  return <span className="health-log-note">日常情况</span>;
}

export default function HealthLogsPage() {
  const navigate = useNavigate();
  const mobile = Grid.useBreakpoint().md === false;
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<HealthLogFormValues>();
  const [selectedUserOverride, setSelectedUserOverride] = useState('');
  const [range, setRange] = useState('7');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const users = usersQuery.data ?? [];
  const preferredUserId = users.find((user) => user.name.trim() === '西西')?.id ?? users[0]?.id ?? '';
  const selectedUserId = users.some((user) => user.id === selectedUserOverride)
    ? selectedUserOverride
    : preferredUserId;
  const queryFrom = range === 'all'
    ? undefined
    : dayjs().subtract(Number(range) - 1, 'day').startOf('day').toISOString();
  const logsQuery = useQuery({
    queryKey: ['health-logs', selectedUserId, range],
    queryFn: () => listHealthLogs({ userId: selectedUserId, ...(queryFrom ? { from: queryFrom } : {}) }),
    enabled: Boolean(selectedUserId),
  });
  const logs = logsQuery.data ?? emptyHealthLogs;
  const recentMedicationNames = [...new Set(
    logs.filter((log) => log.type === 'medication' && log.medicineName).map((log) => log.medicineName as string),
  )].slice(0, 8);

  const closeEditor = () => {
    setEditor(null);
    form.resetFields();
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: HealthLogPayload) => {
      const savedLog = editor?.record
        ? await updateHealthLog(editor.record.id, payload)
        : await createHealthLog(payload);
      if (editor?.reminderId && !editor.record) {
        try {
          await actOnHealthReminder(editor.reminderId, 'complete');
        } catch {
          message.warning('记录已保存，但提醒未能完成；请在提醒列表中手动处理。');
        }
      }
      return savedLog;
    },
    onSuccess: async (savedLog) => {
      const userKey = ['health-logs', savedLog.userId];
      await queryClient.cancelQueries({ queryKey: userKey });
      const outsideRange = queryFrom && dayjs(savedLog.occurredAt).isBefore(queryFrom);
      const visibleRange = outsideRange ? 'all' : range;
      queryClient.setQueryData<HealthLog[]>([...userKey, visibleRange], (previous = []) =>
        [savedLog, ...previous.filter((log) => log.id !== savedLog.id)].sort(
          (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
            || Date.parse(b.createdAt) - Date.parse(a.createdAt),
        ),
      );
      if (outsideRange) setRange('all');
      message.success(editor?.record ? '记录已更新' : '记录已保存');
      closeEditor();
      void queryClient.invalidateQueries({ queryKey: userKey });
      void queryClient.invalidateQueries({ queryKey: ['health-reminders', savedLog.userId] });
    },
    onError: (error) => message.error(extractErrorMessage(error, '记录保存失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHealthLog,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['health-logs', selectedUserId] });
      message.success('记录已删除');
      setDeletingId(null);
    },
    onError: (error) => {
      setDeletingId(null);
      message.error(extractErrorMessage(error, '删除失败'));
    },
  });

  const openCreate = (type: HealthLogType, reminderId?: string) => {
    form.resetFields();
    form.setFieldsValue({ occurredAt: dayjs(), symptoms: [] });
    setEditor({ type, reminderId });
  };

  const openEdit = (record: HealthLog) => {
    form.resetFields();
    form.setFieldsValue({
      occurredAt: dayjs(record.occurredAt),
      temperature: record.temperature ?? undefined,
      medicineName: record.medicineName ?? undefined,
      dosage: record.dosage ?? undefined,
      symptoms: splitSymptoms(record.symptoms),
      note: record.note ?? undefined,
    });
    setEditor({ type: record.type, record });
  };

  const save = async () => {
    if (!editor || !selectedUserId || saveMutation.isPending) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const payload: HealthLogPayload = {
      ...(editor.record ? {} : { userId: selectedUserId }),
      type: editor.type,
      occurredAt: values.occurredAt.toISOString(),
      temperature: editor.type === 'temperature' ? values.temperature : null,
      medicineName: editor.type === 'medication' ? values.medicineName?.trim() || null : null,
      dosage: editor.type === 'medication' ? values.dosage?.trim() || null : null,
      symptoms: editor.type === 'symptom' ? values.symptoms?.join('、') || null : null,
      note: values.note?.trim() || null,
    };

    await saveMutation.mutateAsync(payload).catch(() => undefined);
  };

  const trendLogs = useMemo(() => {
    const cutoff = dayjs().subtract(6, 'day').startOf('day');
    return logs.filter((log) => log.type === 'temperature' && !dayjs(log.occurredAt).isBefore(cutoff) && !dayjs(log.occurredAt).isAfter(dayjs()));
  }, [logs]);

  if (usersQuery.isLoading) return <div className="page-loading"><Spin /></div>;
  if (usersQuery.isError) {
    return <Alert type="error" showIcon message="无法载入家庭成员" description={extractErrorMessage(usersQuery.error)} />;
  }

  if (!users.length) {
    return (
      <section className="health-logs-page">
        <PageHeader eyebrow="日常病程" title="西西记录" description="用简单的时间线记录体温、服药和每天的身体情况。" />
        <Card><Empty description="请先添加一位家庭成员，再开始记录。"><Button type="primary" onClick={() => navigate('/users')}>添加家庭成员</Button></Empty></Card>
      </section>
    );
  }

  const editorTitle = editor ? `${editor.record ? '编辑' : '记录'}${logTypes[editor.type].label}` : '';

  return (
    <section className="health-logs-page">
      <PageHeader
        eyebrow="日常病程"
        title="西西记录"
        description="快速记录体温、服药和身体变化，方便回看这几天的情况。"
      />

      <div className="health-logs-toolbar">
        <label className="health-member-select">
          <span>记录对象</span>
          <Select
            value={selectedUserId}
            onChange={setSelectedUserOverride}
            options={users.map((user) => ({ value: user.id, label: user.name }))}
            aria-label="选择记录对象"
          />
        </label>
        <Select
          className="health-range-select"
          value={range}
          onChange={setRange}
          options={rangeOptions}
          aria-label="选择记录时间范围"
        />
      </div>

      <div className="health-quick-actions">
        <Button className="health-quick-action temperature" onClick={() => openCreate('temperature')}>
          <FireOutlined /><span>记体温</span><small>输入读数</small>
        </Button>
        <Button className="health-quick-action medication" onClick={() => openCreate('medication')}>
          <MedicineBoxOutlined /><span>记服药</span><small>记下实际用量</small>
        </Button>
        <Button className="health-quick-action symptom" onClick={() => openCreate('symptom')}>
          <HeartOutlined /><span>记症状</span><small>记录身体感受</small>
        </Button>
      </div>

      <HealthRemindersPanel
        userId={selectedUserId}
        onRecord={(kind, reminderId) => openCreate(kind, reminderId)}
      />

      <TemperatureTrend logs={trendLogs} />

      <Card
        className="health-timeline-card"
        title="病程时间线"
        extra={(
          <Space size={8}>
            <Tag>{logs.length} 条</Tag>
            <Button size="small" icon={<EditOutlined />} onClick={() => openCreate('note')}>记日常</Button>
          </Space>
        )}
      >
        {logsQuery.isError && (
          <Alert type="error" showIcon message="病程列表刷新失败" description={extractErrorMessage(logsQuery.error)}
            action={<Button size="small" onClick={() => void logsQuery.refetch()}>重试</Button>} />
        )}
        {logsQuery.isLoading ? (
          <div className="page-loading"><Spin /></div>
        ) : logs.length ? (
          <div className="health-log-list">
            {logs.map((log) => (
              <article key={log.id} className="health-log-row">
                <span className={`health-log-icon ${log.type}`}>{logTypes[log.type].icon}</span>
                <div className="health-log-main">
                  <div className="health-log-heading">
                    <Tag>{logTypes[log.type].label}</Tag>
                    <time dateTime={log.occurredAt}>{dayjs(log.occurredAt).format('M月D日 HH:mm')}</time>
                  </div>
                  <HealthLogDetail log={log} />
                  {log.note && <p className="health-log-note">{log.note}</p>}
                </div>
                <Space className="health-log-actions" size={4}>
                  <Button type="text" size="small" aria-label={`编辑${logTypes[log.type].label}`} icon={<EditOutlined />} onClick={() => openEdit(log)} />
                  <Popconfirm title="删除这条记录？" okText="删除" cancelText="取消" onConfirm={() => { setDeletingId(log.id); deleteMutation.mutate(log.id); }}>
                    <Button type="text" danger size="small" aria-label="删除记录" icon={<DeleteOutlined />} loading={deletingId === log.id} />
                  </Popconfirm>
                </Space>
              </article>
            ))}
          </div>
        ) : !logsQuery.isError && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有病程记录">
            <Typography.Text type="secondary">从上方快速记下第一次体温、服药或身体情况。</Typography.Text>
          </Empty>
        )}
      </Card>

      <p className="health-log-disclaimer">这里只帮助整理个人记录，不提供诊断或用药建议。</p>

      <Modal
        className="responsive-modal health-log-modal"
        title={editorTitle}
        open={Boolean(editor)}
        onCancel={() => { if (!saveMutation.isPending) closeEditor(); }}
        cancelButtonProps={{ disabled: saveMutation.isPending }}
        closable={!saveMutation.isPending}
        keyboard={!saveMutation.isPending}
        maskClosable={false}
        onOk={save}
        okText="保存记录"
        cancelText="取消"
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        {editor && (
          <Form form={form} layout="vertical" requiredMark={false} preserve={false}>
            <Form.Item label="记录时间" name="occurredAt" rules={[{ required: true, message: '请选择时间' }]}>
              {mobile
                ? <MobileRecordTime />
                : <DatePicker showTime format="M月D日 HH:mm" className="health-time-picker" allowClear={false} />}
            </Form.Item>
            {editor.type === 'temperature' && (
              <Form.Item label="体温（°C）" name="temperature" rules={[{ required: true, message: '请输入体温' }]}>
                <InputNumber className="health-temperature-input" inputMode="decimal" min={25} max={45} step={0.1} precision={1} placeholder="例如 38.2" />
              </Form.Item>
            )}
            {editor.type === 'medication' && (
              <>
                <Form.Item label="药品名称" name="medicineName" rules={[{ required: true, whitespace: true, message: '请输入药品名称' }]}>
                  <AutoComplete
                    options={recentMedicationNames.map((value) => ({ value }))}
                    placeholder="输入药名，可从近期记录中选择"
                    filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
                <Form.Item label="实际用量（选填）" name="dosage" extra="按实际情况填写，不会自动计算或推荐剂量。">
                  <Input placeholder="例如：1 片、5 ml" maxLength={100} />
                </Form.Item>
              </>
            )}
            {editor.type === 'symptom' && (
              <Form.Item label="症状或身体感受" name="symptoms" rules={[{ required: true, type: 'array', min: 1, message: '请选择或输入至少一项' }]}>
                <Select
                  mode="tags"
                  options={symptomOptions}
                  placeholder="选择常见情况，也可以直接输入"
                  tokenSeparators={['，', ',']}
                  maxTagCount="responsive"
                />
              </Form.Item>
            )}
            {editor.type === 'note' && (
              <Form.Item label="日常情况" name="note" rules={[{ required: true, whitespace: true, message: '请填写情况' }]}>
                <Input.TextArea rows={3} maxLength={1000} showCount placeholder="记录精神、食欲、睡眠等变化" />
              </Form.Item>
            )}
            {editor.type !== 'note' && (
              <Form.Item label="补充说明（选填）" name="note">
                <Input.TextArea rows={3} maxLength={1000} showCount placeholder="可以补充当时的情况" />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </section>
  );
}
