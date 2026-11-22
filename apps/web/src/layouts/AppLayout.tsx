import { Grid, Layout, Menu, Dropdown, Avatar, Space, Typography } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  TeamOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const mobile = Grid.useBreakpoint().lg === false;
  const navigate = useNavigate();
  const location = useLocation();
  const account = useAuthStore((state) => state.account);
  const clear = useAuthStore((state) => state.clear);

  const handleLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/users', icon: <TeamOutlined />, label: '家庭成员' },
    { key: '/visits', icon: <MedicineBoxOutlined />, label: '就诊记录' },
  ];

  const selectedKey =
    menuItems
      .map((item) => item.key)
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!mobile && <Sider theme="dark">
        <div
          style={{
            color: '#fff',
            textAlign: 'center',
            padding: '16px 0',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          医疗记录系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>}
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            background: '#fff',
            padding: mobile ? '0 12px' : '0 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Typography.Text>{account?.email ?? '未登录'}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>
        {mobile && (
          <nav aria-label="主导航">
            <Menu mode="horizontal" selectedKeys={[selectedKey]} items={menuItems}
              onClick={({ key }) => navigate(key)} style={{ justifyContent: 'center' }} />
          </nav>
        )}
        <Content style={{ margin: mobile ? 8 : 24, minWidth: 0 }}>
          <div style={{ background: '#fff', padding: mobile ? 12 : 24, minHeight: 360, borderRadius: 8 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
