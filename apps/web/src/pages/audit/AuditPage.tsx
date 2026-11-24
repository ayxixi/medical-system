import { useInfiniteQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, List, Space, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { apiClient, extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/auth';

interface AuditItem {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  method: string;
  statusCode: number;
  succeeded: boolean;
}

interface AuditPageResult {
  items: AuditItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

const actionLabels: Record<string, string> = {
  'User.create': '新增成员', 'User.update': '修改成员', 'User.remove': '删除成员',
  'Visit.create': '新增就诊', 'Visit.update': '修改就诊', 'Visit.remove': '删除就诊',
  'Record.create': '新增诊断', 'Record.update': '修改诊断', 'Record.remove': '删除诊断',
  'Medication.create': '新增用药', 'Medication.update': '修改用药', 'Medication.remove': '删除用药',
  'File.upload': '上传附件', 'File.replace': '替换附件', 'File.remove': '删除附件',
};

export default function AuditPage() {
  const accountId = useAuthStore((state) => state.account?.id);
  const query = useInfiniteQuery({
    queryKey: ['audit-history', accountId],
    enabled: Boolean(accountId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await apiClient.get<AuditPageResult>('/audit', {
        params: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
      });
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return <section>
    <PageHeader title="操作记录" description="查看此账号近期的资料变更操作。记录只包含操作类型和状态，不包含病历正文或附件内容。" />
    {query.isError && <Alert type="error" showIcon message="操作记录载入失败" description={extractErrorMessage(query.error)} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
    {query.isPending ? <div className="page-loading"><Spin /></div> : items.length === 0 ? <Card><Empty description="暂无操作记录" /></Card> : <>
      <List
        dataSource={items}
        rowKey="id"
        renderItem={(item) => <List.Item>
          <Card size="small" style={{ width: '100%' }}>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Space wrap>
                <Typography.Text strong>{actionLabels[item.action] ?? item.action}</Typography.Text>
                <Tag color={item.succeeded ? 'green' : 'red'}>{item.succeeded ? '成功' : `失败 ${item.statusCode}`}</Tag>
              </Space>
              <Typography.Text type="secondary">{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')} · {item.method} · {item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ''}</Typography.Text>
            </Space>
          </Card>
        </List.Item>}
      />
      {query.hasNextPage && <div style={{ textAlign: 'center', padding: 16 }}><Button loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>加载更多</Button></div>}
    </>}
  </section>;
}
