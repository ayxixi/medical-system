import { useEffect } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Spin, Statistic, Typography, App as AntdApp } from 'antd';
import { TeamOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentAccount, setUsername } from '@/api/auth';
import { listUsers } from '@/api/users';
import { listVisits } from '@/api/visits';
import { useAuthStore } from '@/store/auth';
import { extractErrorMessage } from '@/api/client';

export default function HomePage() {
  const navigate = useNavigate();
  const setAccount = useAuthStore((state) => state.setAccount);
  const { message } = AntdApp.useApp();
  const [usernameForm] = Form.useForm<{ username: string }>();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentAccount,
  });

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const visitsQuery = useQuery({ queryKey: ['visits', {}], queryFn: () => listVisits() });

  useEffect(() => {
    if (meQuery.data) {
      setAccount(meQuery.data);
    }
  }, [meQuery.data, setAccount]);

  if (meQuery.isLoading) {
    return <Spin />;
  }

  if (meQuery.isError) {
    return (
      <Alert
        type="error"
        message="加载账号信息失败"
        description={extractErrorMessage(meQuery.error)}
      />
    );
  }

  return (
    <div>
      <Typography.Title level={3}>欢迎，{meQuery.data?.username ?? meQuery.data?.email}</Typography.Title>
      {!meQuery.data?.username && (
        <Card title="设置登录用户名" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            设置后可使用用户名登录。邮箱登录仍可继续使用。
          </Typography.Paragraph>
          <Form form={usernameForm} layout="inline" onFinish={async ({ username }) => {
            try {
              const updated = await setUsername(username);
              setAccount(updated);
              await meQuery.refetch();
              message.success('用户名已设置');
            } catch (error) {
              message.error(extractErrorMessage(error, '用户名设置失败'));
            }
          }}>
            <Form.Item name="username" rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 32, message: '用户名长度为 3 至 32 位' },
              { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: '以字母或数字开头，只能包含字母、数字、点、下划线和连字符' },
            ]}>
              <Input placeholder="用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item><Button type="primary" htmlType="submit">保存用户名</Button></Form.Item>
          </Form>
        </Card>
      )}
      <Typography.Paragraph type="secondary">
        在左侧菜单可进入家庭成员与就诊记录管理。
      </Typography.Paragraph>

      <Row gutter={16}>
        <Col xs={24} md={12} lg={8}>
          <Card>
            <Statistic
              title="家庭成员"
              value={usersQuery.data?.length ?? 0}
              prefix={<TeamOutlined />}
              loading={usersQuery.isLoading}
            />
            <Button type="link" style={{ paddingLeft: 0 }} onClick={() => navigate('/users')}>
              管理成员
            </Button>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card>
            <Statistic
              title="就诊记录"
              value={visitsQuery.data?.length ?? 0}
              prefix={<MedicineBoxOutlined />}
              loading={visitsQuery.isLoading}
            />
            <Button type="link" style={{ paddingLeft: 0 }} onClick={() => navigate('/visits')}>
              查看就诊
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
