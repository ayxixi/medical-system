import { useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { TableProps } from 'antd';
import { listUsers } from '@/api/users';
import {
  createVisit,
  deleteVisit,
  listVisits,
  type CreateVisitPayload,
  type ListVisitsQuery,
  type Visit,
} from '@/api/visits';
import { extractErrorMessage } from '@/api/client';
import { RecognitionInputActions } from '@/components/RecognitionInputActions';

interface VisitFormValues {
  userId: string;
  date: Dayjs;
  hospital?: string;
  department?: string;
  doctor?: string;
  note?: string;
}

interface FilterValues {
  userId?: string;
  range?: [Dayjs | null, Dayjs | null] | null;
  q?: string;
}

interface SortState {
  sortBy: 'date' | 'createdAt';
  order: 'asc' | 'desc';
}

const DEFAULT_SORT: SortState = { sortBy: 'date', order: 'desc' };

export default function VisitsPage() {
  const { message, modal } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [keywordInput, setKeywordInput] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [form] = Form.useForm<VisitFormValues>();
  const currentNote = Form.useWatch('note', form) ?? '';

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const queryParams = useMemo<ListVisitsQuery>(() => {
    const params: ListVisitsQuery = { sortBy: sort.sortBy, order: sort.order };
    if (filters.userId) params.userId = filters.userId;
    if (filters.range?.[0]) params.from = filters.range[0]!.startOf('day').toISOString();
    if (filters.range?.[1]) params.to = filters.range[1]!.endOf('day').toISOString();
    if (filters.q) params.q = filters.q;
    return params;
  }, [filters, sort]);

  const visitsQuery = useQuery({
    queryKey: ['visits', queryParams],
    queryFn: () => listVisits(queryParams),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['visits'] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateVisitPayload) => createVisit(payload),
    onSuccess: () => {
      message.success('已新增就诊记录');
      setCreating(false);
      form.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '新增失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVisit,
    onSuccess: () => {
      message.success('已删除就诊记录');
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const openCreate = () => {
    setCreating(true);
    form.resetFields();
    if (usersQuery.data && usersQuery.data.length > 0) {
      form.setFieldsValue({ userId: usersQuery.data[0].id, date: dayjs() });
    }
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    createMutation.mutate({
      userId: values.userId,
      date: values.date.toISOString(),
      hospital: values.hospital,
      department: values.department,
      doctor: values.doctor,
      note: values.note,
    });
  };

  const handleDelete = (visit: Visit) => {
    modal.confirm({
      title: '确认删除该就诊记录？',
      content: '相关的诊断、用药与附件会一并删除。',
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(visit.id),
    });
  };

  return (
    <div>
      <Space wrap style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          就诊记录
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          disabled={!usersQuery.data || usersQuery.data.length === 0}
        >
          新增就诊
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="按成员筛选"
          style={{ width: 200 }}
          value={filters.userId}
          onChange={(value) => setFilters((prev) => ({ ...prev, userId: value }))}
          options={(usersQuery.data ?? []).map((user) => ({ value: user.id, label: user.name }))}
        />
        <DatePicker.RangePicker
          value={filters.range as never}
          onChange={(range) =>
            setFilters((prev) => ({
              ...prev,
              range: (range as [Dayjs | null, Dayjs | null] | null) ?? null,
            }))
          }
        />
        <Input.Search
          allowClear
          placeholder="搜索医院 / 科室 / 医生 / 诊断 / 用药 / 备注"
          enterButton={<SearchOutlined />}
          style={{ width: "min(320px, calc(100vw - 48px))" }}
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onSearch={(value) =>
            setFilters((prev) => ({ ...prev, q: value.trim() ? value.trim() : undefined }))
          }
        />
        <Button
          onClick={() => {
            setFilters({});
            setKeywordInput('');
            setSort(DEFAULT_SORT);
          }}
        >
          重置
        </Button>
      </Space>

      <Table<Visit>
        scroll={{ x: "max-content" }}
        rowKey="id"
        loading={visitsQuery.isLoading}
        dataSource={visitsQuery.data ?? []}
        pagination={{ pageSize: 10 }}
        onChange={((_, __, sorter) => {
          const single = Array.isArray(sorter) ? sorter[0] : sorter;
          if (!single || !single.order) {
            setSort(DEFAULT_SORT);
            return;
          }
          const field = (single.field as string) ?? 'date';
          const sortBy: SortState['sortBy'] =
            field === 'createdAt' ? 'createdAt' : 'date';
          setSort({ sortBy, order: single.order === 'ascend' ? 'asc' : 'desc' });
        }) as TableProps<Visit>['onChange']}
        columns={[
          {
            title: '就诊日期',
            dataIndex: 'date',
            sorter: true,
            sortOrder:
              sort.sortBy === 'date' ? (sort.order === 'asc' ? 'ascend' : 'descend') : null,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            sorter: true,
            sortOrder:
              sort.sortBy === 'createdAt' ? (sort.order === 'asc' ? 'ascend' : 'descend') : null,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
            responsive: ['lg'],
          },
          {
            title: '成员',
            dataIndex: ['user', 'name'],
            render: (_, record) => record.user?.name ?? '-',
          },
          { title: '医院', dataIndex: 'hospital', render: (value) => value ?? '-' },
          { title: '科室', dataIndex: 'department', render: (value) => value ?? '-' },
          { title: '医生', dataIndex: 'doctor', render: (value) => value ?? '-' },
          {
            title: '诊断 / 用药 / 附件',
            key: 'counts',
            render: (_, record) =>
              `${record.records?.length ?? 0} / ${record.medications?.length ?? 0} / ${
                record.files?.length ?? 0
              }`,
          },
          {
            title: '操作',
            key: 'actions',
            width: 160,
            render: (_, record) => (
              <Space>
                <Link to={`/visits/${record.id}`}>详情</Link>
                <Button size="small" danger onClick={() => handleDelete(record)}>
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="新增就诊记录"
        open={creating}
        onOk={onSubmit}
        onCancel={() => setCreating(false)}
        confirmLoading={createMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="成员"
            name="userId"
            rules={[{ required: true, message: '请选择成员' }]}
          >
            <Select
              placeholder="选择成员"
              options={(usersQuery.data ?? []).map((user) => ({
                value: user.id,
                label: user.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="就诊日期"
            name="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="医院" name="hospital">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="科室" name="department">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="医生" name="doctor">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="备注">
            <Form.Item name="note" noStyle>
              <Input.TextArea rows={3} maxLength={1000} />
            </Form.Item>
            <RecognitionInputActions
              currentText={currentNote}
              onText={(note) => form.setFieldValue('note', note)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
