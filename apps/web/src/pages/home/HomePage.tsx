import { useEffect } from 'react';
import { Alert, App as AntdApp, Button, Card, Col, Empty, Form, Input, Row, Statistic, Typography } from 'antd';
import { ArrowRightOutlined, MedicineBoxOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentAccount, setUsername } from '@/api/auth';
import { listUsers } from '@/api/users';
import { listVisits } from '@/api/visits';
import { useAuthStore } from '@/store/auth';
import { extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';

export default function HomePage() {
  const navigate = useNavigate();
  const setAccount = useAuthStore((state) => state.setAccount);
  const { message } = AntdApp.useApp();
  const [usernameForm] = Form.useForm<{ username: string }>();
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentAccount });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const visitsQuery = useQuery({ queryKey: ['visits', {}], queryFn: () => listVisits() });

  useEffect(() => {
    if (meQuery.data) setAccount(meQuery.data);
  }, [meQuery.data, setAccount]);

  if (meQuery.isLoading) return <div className="page-loading"><Typography.Text type="secondary">正在载入工作台…</Typography.Text></div>;
  if (meQuery.isError) {
    return <Alert type="error" showIcon message="无法载入账号信息" description={extractErrorMessage(meQuery.error)} />;
  }

  const accountName = meQuery.data?.username ?? meQuery.data?.email ?? '你好';
  const latestVisits = visitsQuery.data?.slice(0, 4) ?? [];

  return (
    <section>
      <PageHeader
        eyebrow="个人健康空间"
        title={`欢迎回来，${accountName}`}
        description="把重要的就诊信息集中整理，随时查看自己和家人的健康记录。"
      />

      <div className="home-welcome">
        <h2>每一份记录，都值得被好好保存。</h2>
        <p>从家庭成员开始，逐步建立清晰、完整的就诊档案。</p>
      </div>

      {!meQuery.data?.username && (
        <Card className="username-card" style={{ marginBottom: 18 }}>
          <div className="username-card-copy">
            <Typography.Title level={5} style={{ margin: 0 }}>设置登录用户名</Typography.Title>
            <Typography.Text type="secondary">设置后可用用户名登录，邮箱登录也会继续保留。</Typography.Text>
          </div>
          <Form
            className="username-form"
            form={usernameForm}
            layout="vertical"
            onFinish={async ({ username }) => {
              try {
                const updated = await setUsername(username);
                setAccount(updated);
                await meQuery.refetch();
                message.success('用户名已设置');
              } catch (error) {
                message.error(extractErrorMessage(error, '用户名设置失败'));
              }
            }}
          >
            <Form.Item name="username" rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 32, message: '用户名长度为 3 至 32 位' },
              { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: '以字母或数字开头，可使用点、下划线和连字符' },
            ]}>
              <Input placeholder="设置用户名" autoComplete="username" />
            </Form.Item>
            <Button type="primary" htmlType="submit">保存用户名</Button>
          </Form>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card className="home-stat-card">
            <div className="home-stat-top">
              <Statistic title="家庭成员" value={usersQuery.data?.length ?? 0} loading={usersQuery.isLoading} />
              <span className="stat-icon"><TeamOutlined /></span>
            </div>
            <Button type="link" className="home-stat-link" onClick={() => navigate('/users')}>
              管理成员 <ArrowRightOutlined />
            </Button>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card className="home-stat-card">
            <div className="home-stat-top">
              <Statistic title="就诊记录" value={visitsQuery.data?.length ?? 0} loading={visitsQuery.isLoading} />
              <span className="stat-icon"><MedicineBoxOutlined /></span>
            </div>
            <Button type="link" className="home-stat-link" onClick={() => navigate('/visits')}>
              查看就诊 <ArrowRightOutlined />
            </Button>
          </Card>
        </Col>
      </Row>

      <Card className="home-section" title="最近就诊" extra={<Link to="/visits">全部记录 <ArrowRightOutlined /></Link>}>
        {visitsQuery.isError ? (
          <Alert type="error" showIcon message="最近就诊记录载入失败" description={extractErrorMessage(visitsQuery.error)} />
        ) : visitsQuery.isLoading ? (
          <div className="page-loading"><Typography.Text type="secondary">正在载入就诊记录…</Typography.Text></div>
        ) : latestVisits.length ? (
          latestVisits.map((visit) => (
            <Link className="recent-visit-row" key={visit.id} to={`/visits/${visit.id}`}>
              <span className="recent-visit-date">{dayjs(visit.date).format('MM/DD')}</span>
              <span className="recent-visit-main">
                <strong>{visit.hospital || '就诊记录'}</strong>
                <span>{visit.user?.name ?? '家庭成员'} · {dayjs(visit.date).format('YYYY年M月D日')}</span>
              </span>
              <ArrowRightOutlined className="recent-visit-arrow" />
            </Link>
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有就诊记录">
            <Button type="primary" onClick={() => navigate('/visits')}>添加就诊记录</Button>
          </Empty>
        )}
      </Card>
    </section>
  );
}
