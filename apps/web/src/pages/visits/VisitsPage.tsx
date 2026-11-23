import { useEffect, useMemo, useState } from 'react';
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
  Pagination,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { PageHeader } from '@/components/PageHeader';

interface VisitFormValues {
  userId: string;
  date: Dayjs;
  hospital?: string;
  department?: string;
  doctor?: string;
  note?: string;
}
interface FilterValues { userId?: string; range?: [Dayjs | null, Dayjs | null] | null; q?: string; }
interface SortState { sortBy: 'date' | 'createdAt'; order: 'asc' | 'desc'; }
const DEFAULT_SORT: SortState = { sortBy: 'date', order: 'desc' };

export default function VisitsPage() {
  const { message, modal } = AntdApp.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [keywordInput, setKeywordInput] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [mobilePage, setMobilePage] = useState(1);
  const [form] = Form.useForm<VisitFormValues>();

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const queryParams = useMemo<ListVisitsQuery>(() => {
    const params: ListVisitsQuery = { sortBy: sort.sortBy, order: sort.order };
    if (filters.userId) params.userId = filters.userId;
    if (filters.range?.[0]) params.from = filters.range[0].startOf('day').toISOString();
    if (filters.range?.[1]) params.to = filters.range[1].endOf('day').toISOString();
    if (filters.q) params.q = filters.q;
    return params;
  }, [filters, sort]);
  const visitsQuery = useQuery({
    queryKey: ['visits', queryParams],
    queryFn: () => listVisits(queryParams),
  });
  useEffect(() => setMobilePage(1), [queryParams]);
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
    onSuccess: () => { message.success('已删除就诊记录'); invalidate(); },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const openCreate = () => {
    form.resetFields();
    if (usersQuery.data?.length) form.setFieldsValue({ userId: usersQuery.data[0].id, date: dayjs() });
    setCreating(true);
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
  const confirmDelete = (visit: Visit) => {
    modal.confirm({
      title: '删除这条就诊记录？',
      content: '相关诊断、用药和附件记录也会删除，且无法恢复。',
      okType: 'danger',
      okText: '确认删除',
      cancelText: '保留记录',
      onOk: () => deleteMutation.mutateAsync(visit.id),
    });
  };
  const handleSort: TableProps<Visit>['onChange'] = (_, __, sorter) => {
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.order) { setSort(DEFAULT_SORT); return; }
    const field = single.field === 'createdAt' ? 'createdAt' : 'date';
    setSort({ sortBy: field, order: single.order === 'ascend' ? 'asc' : 'desc' });
  };

  const visits = visitsQuery.data ?? [];
  const mobileVisits = visits.slice((mobilePage - 1) * 8, mobilePage * 8);

  return (
    <section>
      <PageHeader
        eyebrow="就诊档案"
        title="就诊记录"
        description="按成员和日期查看，或搜索医院、诊断、用药与备注。"
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            disabled={!usersQuery.data?.length}>
            新增就诊
          </Button>
        )}
      />

      {usersQuery.isError && (
        <Alert type="error" showIcon message="成员列表载入失败"
          description={extractErrorMessage(usersQuery.error)} style={{ marginBottom: 16 }} />
      )}
      {!usersQuery.isLoading && !usersQuery.isError && !usersQuery.data?.length && (
        <Alert showIcon type="info" message="先添加一位家庭成员，再创建就诊记录。"
          action={<Button size="small" onClick={() => navigate('/users')}>添加成员</Button>}
          style={{ marginBottom: 16 }} />
      )}

      <Card className="visit-filter-card">
        <div className="visit-filter-grid">
          <Select
            allowClear
            placeholder="全部成员"
            className="filter-member"
            value={filters.userId}
            onChange={(value) => setFilters((prev) => ({ ...prev, userId: value }))}
            options={(usersQuery.data ?? []).map((user) => ({ value: user.id, label: user.name }))}
          />
          <DatePicker.RangePicker
            className="filter-date"
            placeholder={['开始日期', '结束日期']}
            value={filters.range as never}
            onChange={(range) => setFilters((prev) => ({
              ...prev,
              range: (range as [Dayjs | null, Dayjs | null] | null) ?? null,
            }))}
          />
          <Input.Search
            allowClear
            className="filter-search"
            placeholder="搜索医院、诊断、用药或备注"
            enterButton={<SearchOutlined />}
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onSearch={(value) => setFilters((prev) => ({ ...prev, q: value.trim() || undefined }))}
          />
          <Button className="filter-reset" onClick={() => {
            setFilters({});
            setKeywordInput('');
            setSort(DEFAULT_SORT);
          }}>重置</Button>
        </div>
      </Card>

      {visitsQuery.isError && (
        <Alert showIcon type="error" message="就诊记录载入失败"
          description={extractErrorMessage(visitsQuery.error)}
          action={<Button size="small" onClick={() => void visitsQuery.refetch()}>重试</Button>}
          style={{ marginBottom: 16 }} />
      )}

      <Card className="visit-table-card desktop-visit-table">
        <Table<Visit>
          rowKey="id"
          loading={visitsQuery.isLoading}
          dataSource={visits}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条记录` }}
          onChange={handleSort}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到就诊记录" /> }}
          columns={[
            {
              title: '就诊日期', dataIndex: 'date', sorter: true,
              sortOrder: sort.sortBy === 'date' ? (sort.order === 'asc' ? 'ascend' : 'descend') : null,
              render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
            },
            { title: '成员', dataIndex: ['user', 'name'], width: 110, render: (_, record) => record.user?.name ?? '-' },
            { title: '医院', dataIndex: 'hospital', render: (value) => value ?? '-' },
            { title: '科室', dataIndex: 'department', responsive: ['lg'], render: (value) => value ?? '-' },
            { title: '医生', dataIndex: 'doctor', responsive: ['xl'], render: (value) => value ?? '-' },
            {
              title: '资料', key: 'counts', width: 165,
              render: (_, record) => (
                <div className="table-counts">
                  <span>诊断 {record.records?.length ?? 0}</span>
                  <span>用药 {record.medications?.length ?? 0}</span>
                  <span>附件 {record.files?.length ?? 0}</span>
                </div>
              ),
            },
            {
              title: '操作', key: 'actions', width: 116,
              render: (_, record) => (
                <div className="table-row-actions">
                  <Link to={`/visits/${record.id}`}>查看详情</Link>
                  <Button type="link" danger size="small" onClick={() => confirmDelete(record)}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <div className="visit-mobile-list">
        {visitsQuery.isLoading ? <Card><div className="page-loading"><Spin /></div></Card> : mobileVisits.length ? mobileVisits.map((visit) => (
          <Card key={visit.id} className="visit-mobile-card">
            <div className="visit-mobile-top">
              <div>
                <div className="visit-date">{dayjs(visit.date).format('YYYY年M月D日 · HH:mm')}</div>
                <div className="visit-person">{visit.user?.name ?? '家庭成员'}</div>
              </div>
              <Button type="link" danger size="small" onClick={() => confirmDelete(visit)}>删除</Button>
            </div>
            <div className="visit-place">{visit.hospital || '就诊记录'}</div>
            <div className="visit-department">
              {[visit.department, visit.doctor].filter(Boolean).join(' · ') || '未填写科室和医生'}
            </div>
            <div className="visit-counts">
              <Tag>诊断 {visit.records?.length ?? 0}</Tag>
              <Tag>用药 {visit.medications?.length ?? 0}</Tag>
              <Tag>附件 {visit.files?.length ?? 0}</Tag>
            </div>
            <div className="visit-mobile-actions">
              <Button type="primary" block onClick={() => navigate(`/visits/${visit.id}`)}>查看就诊详情</Button>
            </div>
          </Card>
        )) : (
          <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到就诊记录" /></Card>
        )}
      </div>
      {!visitsQuery.isLoading && visits.length > 8 && (
        <div className="mobile-pagination">
          <Pagination current={mobilePage} pageSize={8} total={visits.length} showSizeChanger={false}
            showTotal={(total) => `共 ${total} 条记录`} onChange={setMobilePage} />
        </div>
      )}

      <Modal
        className="responsive-modal"
        title="新增就诊记录"
        open={creating}
        onOk={onSubmit}
        onCancel={() => setCreating(false)}
        confirmLoading={createMutation.isPending}
        cancelButtonProps={{ disabled: createMutation.isPending }}
        destroyOnHidden
        width={760}
      >
        <Typography.Paragraph type="secondary">先选择成员和日期，医院、科室等信息可以稍后补充。</Typography.Paragraph>
        <Form form={form} layout="vertical" className="form-grid" onFinish={onSubmit}>
          <Form.Item className="form-wide" label="家庭成员" name="userId" rules={[{ required: true, message: '请选择成员' }]}>
            <Select placeholder="选择一位成员" options={(usersQuery.data ?? []).map((user) => ({ value: user.id, label: user.name }))} />
          </Form.Item>
          <Form.Item label="就诊日期和时间" name="date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item label="医院" name="hospital"><Input maxLength={200} placeholder="医院名称" /></Form.Item>
          <Form.Item label="科室" name="department"><Input maxLength={200} placeholder="例如：心内科" /></Form.Item>
          <Form.Item label="医生" name="doctor"><Input maxLength={200} placeholder="医生姓名" /></Form.Item>
          <Form.Item label="就诊备注" className="form-wide">
            <Form.Item name="note" noStyle><Input.TextArea rows={4} maxLength={1000} showCount placeholder="记录症状、检查结果或其他重要信息" /></Form.Item>
            {creating && <RecognitionInputActions
              getCurrentText={() => form.getFieldValue('note')}
              onText={(note) => form.setFieldValue('note', note)}
            />}
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
