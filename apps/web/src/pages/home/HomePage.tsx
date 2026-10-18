import { useEffect } from 'react';
import { Alert, Button, Card, Col, Row, Spin, Statistic, Typography } from 'antd';
import { TeamOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentAccount } from '@/api/auth';
import { listUsers } from '@/api/users';
import { listVisits } from '@/api/visits';
import { useAuthStore } from '@/store/auth';
import { extractErrorMessage } from '@/api/client';

export default function HomePage() {
  const navigate = useNavigate();
  const setAccount = useAuthStore((state) => state.setAccount);

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
      <Typography.Title level={3}>欢迎，{meQuery.data?.email}</Typography.Title>
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
