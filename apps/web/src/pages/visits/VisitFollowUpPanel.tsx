import { useState } from 'react';
import { Alert, App as AntdApp, Button, Card, DatePicker, Empty, Form, Input, List, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from 'antd';
import { CalendarOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
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
  type HealthReminderPayload,
} from '@/api/healthReminders';

type FollowUpPurpose = 'revisit' | 'test' | 'medication-end' | 'custom';
interface FollowUpFormValues {
  purpose: FollowUpPurpose;
  title: string;
  note?: string;
  nextAt: Dayjs;
}

const purposeOptions = [
  { value: 'revisit', label: '复诊' },
  { value: 'test', label: '检查或查看结果' },
  { value: 'medication-end', label: '用药疗程结束' },
  { value: 'custom', label: '自定义随访' },
];
const suggestedTitles: Record<FollowUpPurpose, string> = {
  revisit: '复诊提醒',
  test: '检查或查看结果',
  'medication-end': '用药疗程结束',
  custom: '随访提醒',
};
const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function VisitFollowUpPanel({ visitId, userId }: { visitId: string; userId: string }) {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FollowUpFormValues>();
  const [editing, setEditing] = useState<HealthReminder | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const queryKey = ['health-reminders', userId, visitId];
  const query = useQuery({
    queryKey,
    queryFn: () => listHealthReminders({ userId, visitId, includeInactive: true }),
    enabled: Boolean(userId && visitId),
  });
  const reminders = query.data ?? [];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ['health-reminders', userId] }),
      queryClient.invalidateQueries({ queryKey: ['user-health-summary'] }),
    ]);
  };
  const saveMutation = useMutation({
    mutationFn: (values: FollowUpFormValues) => {
      const payload: HealthReminderPayload = {
        userId,
        visitId,
        kind: 'custom',
        title: values.title.trim(),
        note: values.note?.trim() || null,
        nextAt: values.nextAt.toISOString(),
        localTime: null,
        timeZone: localTimeZone(),
        repeatDaily: false,
      };
      return editing ? updateHealthReminder(editing.id, {
        title: payload.title,
        note: payload.note,
        nextAt: payload.nextAt,
        repeatDaily: false,
      }) : createHealthReminder(payload);
    },
    onSuccess: async () => {
      await refresh();
      message.success(editing ? '随访提醒已更新' : '随访提醒已创建');
      setEditing(null);
      setEditorOpen(false);
      form.resetFields();
    },
    onError: (error) => message.error(extractErrorMessage(error, '保存随访提醒失败')),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateHealthReminder(id, { isActive: active }),
    onSuccess: async () => { await refresh(); message.success('提醒状态已更新'); },
    onError: (error) => message.error(extractErrorMessage(error, '更新提醒状态失败')),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'complete' | 'snooze' }) => actOnHealthReminder(id, action),
    onSuccess: async (_data, variables) => {
      await refresh();
      message.success(variables.action === 'complete' ? '随访已完成' : '已稍后 10 分钟提醒');
    },
    onError: (error) => message.error(extractErrorMessage(error, '处理随访提醒失败')),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteHealthReminder,
    onSuccess: async () => { await refresh(); message.success('随访提醒已删除'); },
    onError: (error) => message.error(extractErrorMessage(error, '删除随访提醒失败')),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ purpose: 'revisit', title: suggestedTitles.revisit });
    setEditorOpen(true);
  };
  const openEdit = (reminder: HealthReminder) => {
    setEditing(reminder);
    setEditorOpen(true);
    form.setFieldsValue({
      purpose: 'custom',
      title: reminder.title,
      note: reminder.note ?? undefined,
      nextAt: dayjs(reminder.nextAt),
    });
  };
  const submit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (values) await saveMutation.mutateAsync(values).catch(() => undefined);
  };
  const due = (reminder: HealthReminder) => reminder.isActive && !dayjs(reminder.snoozedUntil ?? reminder.nextAt).isAfter(dayjs());

  return <>
    <Card
      className="section-card"
      title={<div className="page-section-title"><CalendarOutlined /> 复诊与随访</div>}
      extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加提醒</Button>}
    >
      <Alert type="info" showIcon message="按医生安排填写日期" description="复诊、检查和疗程日期由你手动确认；系统不会推算用药或治疗计划。提醒需打开西西记录查看，网页关闭期间不会发送系统通知。" style={{ marginBottom: 12 }} />
      {query.isError ? <Alert type="error" showIcon message="随访提醒载入失败" description={extractErrorMessage(query.error)} action={<Button size="small" onClick={() => void query.refetch()}>重试</Button>} />
        : query.isPending ? <div className="page-loading"><Spin /></div>
          : reminders.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这次就诊还没有随访提醒" />
            : <List
              dataSource={reminders}
              rowKey="id"
              renderItem={(reminder) => <List.Item>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space wrap>
                    <Typography.Text strong>{reminder.title}</Typography.Text>
                    {reminder.isActive ? <Tag color="green">待处理</Tag> : <Tag>已暂停</Tag>}
                    {due(reminder) && <Tag color="orange">已到时间</Tag>}
                  </Space>
                  <Typography.Text type="secondary">{dayjs(reminder.snoozedUntil ?? reminder.nextAt).format('YYYY年M月D日 HH:mm')}{reminder.note ? ` · ${reminder.note}` : ''}</Typography.Text>
                  <Space wrap size={4}>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(reminder)}>编辑</Button>
                    {reminder.isActive && <Button type="text" size="small" onClick={() => statusMutation.mutate({ id: reminder.id, active: false })}>暂停</Button>}
                    {!reminder.isActive && <Button type="text" size="small" onClick={() => statusMutation.mutate({ id: reminder.id, active: true })}>恢复</Button>}
                    {due(reminder) && <Button type="text" size="small" onClick={() => actionMutation.mutate({ id: reminder.id, action: 'snooze' })}>稍后 10 分钟</Button>}
                    {due(reminder) && <Button type="text" size="small" onClick={() => actionMutation.mutate({ id: reminder.id, action: 'complete' })}>已完成</Button>}
                    <Popconfirm title="删除这条随访提醒？" okText="删除" cancelText="取消" onConfirm={() => deleteMutation.mutate(reminder.id)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  </Space>
                </Space>
              </List.Item>}
            />}
    </Card>
    <Modal
      className="responsive-modal"
      title={editing ? '编辑随访提醒' : '添加复诊或随访提醒'}
      open={editorOpen}
      onCancel={() => { setEditing(null); setEditorOpen(false); form.resetFields(); }}
      onOk={() => void submit()}
      okText="保存提醒"
      cancelText="取消"
      confirmLoading={saveMutation.isPending}
      destroyOnHidden
      width={480}
    >
      <Form form={form} layout="vertical" initialValues={{ purpose: 'revisit' }}>
        {!editing && <Form.Item name="purpose" label="提醒用途" rules={[{ required: true }]}>
          <Select options={purposeOptions} onChange={(purpose: FollowUpPurpose) => form.setFieldValue('title', suggestedTitles[purpose])} />
        </Form.Item>}
        <Form.Item name="title" label="提醒内容" rules={[{ required: true, whitespace: true, max: 100, message: '请输入提醒内容，最多 100 字' }]}>
          <Input maxLength={100} placeholder="例如：复诊、抽血检查、疗程结束后咨询" />
        </Form.Item>
        <Form.Item name="nextAt" label="提醒时间" rules={[
          { required: true, message: '请选择提醒时间' },
          { validator: async (_rule, value: Dayjs | undefined) => {
            if (value && !value.isAfter(dayjs())) throw new Error('请选择未来时间');
          } },
        ]}>
          <DatePicker className="health-reminder-time-picker" showTime format="YYYY-MM-DD HH:mm" minuteStep={5} disabledDate={(date) => date.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
        <Form.Item name="note" label="备注" rules={[{ max: 500, message: '最多 500 字' }]}>
          <Input.TextArea rows={3} maxLength={500} placeholder="例如：药品名称或医生交代的检查事项" />
        </Form.Item>
      </Form>
    </Modal>
  </>;
}
