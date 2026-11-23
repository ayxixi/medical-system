import { useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '@/api/client';
import {
  actOnHealthReminder,
  createHealthReminder,
  deleteHealthReminder,
  listHealthReminders,
  updateHealthReminder,
  type HealthReminder,
  type HealthReminderKind,
  type HealthReminderPayload,
} from '@/api/healthReminders';

interface ReminderFormValues {
  kind: HealthReminderKind;
  title: string;
  note?: string;
  repeatDaily: boolean;
  nextAt: Dayjs;
  localTime: Dayjs;
}

interface EditorState {
  reminder?: HealthReminder;
}

const reminderKinds: Array<{ value: HealthReminderKind; label: string }> = [
  { value: 'temperature', label: '测量体温' },
  { value: 'medication', label: '服药记录' },
  { value: 'custom', label: '自定义提醒' },
];
const emptyReminders: HealthReminder[] = [];

const dueAt = (reminder: HealthReminder) => dayjs(reminder.snoozedUntil ?? reminder.nextAt);
const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function HealthRemindersPanel({
  userId,
  onRecord,
}: {
  userId: string;
  onRecord: (kind: 'temperature' | 'medication', reminderId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<ReminderFormValues>();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['health-reminders', userId],
    queryFn: () => listHealthReminders({ userId, includeInactive: true }),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });
  const reminders = query.data ?? emptyReminders;
  const activeReminders = reminders.filter((reminder) => reminder.isActive);
  const now = dayjs();
  const dueReminders = activeReminders.filter((reminder) => !dueAt(reminder).isAfter(now));

  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['health-reminders', userId] });

  const saveMutation = useMutation({
    mutationFn: (payload: HealthReminderPayload) => editor?.reminder
      ? updateHealthReminder(editor.reminder.id, {
          kind: payload.kind,
          title: payload.title,
          note: payload.note,
          nextAt: payload.nextAt,
          localTime: payload.localTime,
          timeZone: payload.timeZone,
          repeatDaily: payload.repeatDaily,
        })
      : createHealthReminder(payload),
    onSuccess: async () => {
      await refresh();
      message.success(editor?.reminder ? '提醒已更新' : '提醒已创建');
      setEditor(null);
      form.resetFields();
    },
    onError: (error) => message.error(extractErrorMessage(error, '保存提醒失败')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateHealthReminder(id, { isActive: active }),
    onSuccess: async () => { await refresh(); message.success('提醒状态已更新'); },
    onError: (error) => message.error(extractErrorMessage(error, '更新提醒失败')),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'complete' | 'snooze' }) => actOnHealthReminder(id, action),
    onSuccess: async (_result, variables) => {
      await refresh();
      message.success(variables.action === 'snooze' ? '已稍后 10 分钟提醒' : '提醒已完成');
      setPendingId(null);
    },
    onError: (error) => {
      setPendingId(null);
      message.error(extractErrorMessage(error, '处理提醒失败'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHealthReminder,
    onSuccess: async () => { await refresh(); message.success('提醒已删除'); setPendingId(null); },
    onError: (error) => {
      setPendingId(null);
      message.error(extractErrorMessage(error, '删除提醒失败'));
    },
  });

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      kind: 'temperature',
      repeatDaily: false,
      nextAt: dayjs().add(1, 'hour').startOf('minute'),
      localTime: dayjs().hour(20).minute(0).second(0),
    });
    setEditor({});
  };

  const openEdit = (reminder: HealthReminder) => {
    form.resetFields();
    form.setFieldsValue({
      kind: reminder.kind,
      title: reminder.title,
      note: reminder.note ?? undefined,
      repeatDaily: reminder.repeatDaily,
      nextAt: dayjs(reminder.nextAt),
      localTime: dayjs(`2000-01-01T${reminder.localTime ?? '20:00'}:00`),
    });
    setEditor({ reminder });
  };

  const submit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const payload: HealthReminderPayload = {
      userId,
      kind: values.kind,
      title: values.title.trim(),
      note: values.note?.trim() || null,
      repeatDaily: values.repeatDaily,
      nextAt: values.nextAt.toISOString(),
      localTime: values.repeatDaily ? values.localTime.format('HH:mm') : null,
      timeZone: localTimeZone(),
    };
    await saveMutation.mutateAsync(payload).catch(() => undefined);
  };

  return (
    <Card
      className="health-reminders-card"
      title={<>提醒 <Tag>{activeReminders.length} 项</Tag></>}
      extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加提醒</Button>}
    >
      <Alert
        className="health-reminders-info"
        type="info"
        showIcon
        message="打开西西记录时检查提醒"
        description="网页关闭期间不会发送系统通知。提醒内容由你设置，不会自动计算药量或服药频率。"
      />

      {query.isError ? (
        <Alert type="error" showIcon message="提醒载入失败" description={extractErrorMessage(query.error)} />
      ) : query.isLoading ? (
        <div className="page-loading"><Spin /></div>
      ) : (
        <>
          {dueReminders.length > 0 && (
            <div className="health-reminders-due" aria-live="polite">
              {dueReminders.map((reminder) => (
                <Alert
                  key={reminder.id}
                  type="warning"
                  showIcon
                  message={`到时间了：${reminder.title}`}
                  description={(
                    <div className="health-reminder-due-content">
                      <span>{reminder.note || `${reminder.repeatDaily ? '每日' : '单次'}提醒 · ${dueAt(reminder).format('M月D日 HH:mm')}`}</span>
                      <Space wrap size={6}>
                        {(reminder.kind === 'temperature' || reminder.kind === 'medication') && (
                          <Button size="small" type="primary" onClick={() => onRecord(reminder.kind as 'temperature' | 'medication', reminder.id)}>
                            去记录
                          </Button>
                        )}
                        <Button
                          size="small"
                          loading={pendingId === reminder.id && actionMutation.isPending}
                          onClick={() => { setPendingId(reminder.id); actionMutation.mutate({ id: reminder.id, action: 'snooze' }); }}
                        >
                          稍后 10 分钟
                        </Button>
                        <Button
                          size="small"
                          loading={pendingId === reminder.id && actionMutation.isPending}
                          onClick={() => { setPendingId(reminder.id); actionMutation.mutate({ id: reminder.id, action: 'complete' }); }}
                        >
                          已完成
                        </Button>
                      </Space>
                    </div>
                  )}
                />
              ))}
            </div>
          )}

          {reminders.length ? (
            <div className="health-reminder-list">
              {reminders.map((reminder) => (
                <article key={reminder.id} className={`health-reminder-row${reminder.isActive ? '' : ' is-paused'}`}>
                  <div className="health-reminder-main">
                    <div className="health-reminder-heading">
                      <strong>{reminder.title}</strong>
                      <Tag>{reminderKinds.find((kind) => kind.value === reminder.kind)?.label}</Tag>
                      {!reminder.isActive && <Tag>已暂停</Tag>}
                      {reminder.repeatDaily && <Tag color="blue">每日 {reminder.localTime}</Tag>}
                    </div>
                    <Typography.Text type="secondary">
                      {reminder.repeatDaily
                        ? `下次 ${dayjs(reminder.snoozedUntil ?? reminder.nextAt).format('M月D日 HH:mm')}`
                        : `单次 · ${dayjs(reminder.snoozedUntil ?? reminder.nextAt).format('M月D日 HH:mm')}`}
                      {reminder.note ? ` · ${reminder.note}` : ''}
                    </Typography.Text>
                  </div>
                  <Space size={2} className="health-reminder-actions">
                    <Button type="text" size="small" aria-label="编辑提醒" icon={<EditOutlined />} onClick={() => openEdit(reminder)} />
                    <Button
                      type="text"
                      size="small"
                      onClick={() => updateMutation.mutate({ id: reminder.id, active: !reminder.isActive })}
                    >
                      {reminder.isActive ? '暂停' : '恢复'}
                    </Button>
                    <Popconfirm title="删除这个提醒？" okText="删除" cancelText="取消" onConfirm={() => { setPendingId(reminder.id); deleteMutation.mutate(reminder.id); }}>
                      <Button type="text" size="small" danger aria-label="删除提醒" icon={<DeleteOutlined />} loading={pendingId === reminder.id && deleteMutation.isPending} />
                    </Popconfirm>
                  </Space>
                </article>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有提醒" />
          )}
        </>
      )}

      <Modal
        className="responsive-modal health-reminder-modal"
        title={editor?.reminder ? '编辑提醒' : '添加提醒'}
        open={Boolean(editor)}
        onCancel={() => { setEditor(null); form.resetFields(); }}
        onOk={submit}
        okText="保存提醒"
        cancelText="取消"
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={460}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="kind" label="提醒类型" rules={[{ required: true }]}>
            <Select options={reminderKinds} />
          </Form.Item>
          <Form.Item name="title" label="提醒内容" rules={[{ required: true, whitespace: true, max: 100, message: '请输入提醒内容（最多 100 字）' }]}>
            <Input placeholder="例如：测量体温、记录服药" maxLength={100} />
          </Form.Item>
          <Form.Item name="note" label="补充说明" rules={[{ max: 500, message: '最多 500 字' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="可选，例如：按医生已提供的安排记录" />
          </Form.Item>
          <Form.Item name="repeatDaily" label="重复" valuePropName="checked">
            <Switch checkedChildren="每日" unCheckedChildren="单次" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.repeatDaily !== current.repeatDaily}>
            {({ getFieldValue }) => getFieldValue('repeatDaily') ? (
              <Form.Item name="localTime" label="每天的提醒时间" rules={[{ required: true, message: '请选择时间' }]}>
                <TimePicker className="health-reminder-time-picker" format="HH:mm" minuteStep={5} />
              </Form.Item>
            ) : (
              <Form.Item name="nextAt" label="提醒时间" rules={[{ required: true, message: '请选择提醒时间' }]}>
                <DatePicker className="health-reminder-time-picker" showTime format="YYYY-MM-DD HH:mm" minuteStep={5} disabledDate={(date) => date.isBefore(dayjs().startOf('day'))} />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
