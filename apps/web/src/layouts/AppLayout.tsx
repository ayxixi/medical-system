import { useState } from 'react';
import { Avatar, Button, Dropdown, Grid, Layout, Typography } from 'antd';
import {
  HomeOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

const { Header, Sider, Content } = Layout;
const navigation = [
  { key: '/', label: '首页', shortLabel: '首页', icon: <HomeOutlined /> },
  { key: '/users', label: '家庭成员', shortLabel: '成员', icon: <TeamOutlined /> },
  { key: '/visits', label: '就诊记录', shortLabel: '就诊', icon: <MedicineBoxOutlined /> },
];

export default function AppLayout() {
  const mobile = Grid.useBreakpoint().lg === false;
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const account = useAuthStore((state) => state.account);
  const clear = useAuthStore((state) => state.clear);
  const selectedKey = navigation
    .map(({ key }) => key)
    .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0] ?? '/';

  const handleLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className={`app-layout${mobile ? ' is-mobile' : ''}`}>
      {!mobile && (
        <Sider
          className="app-sider"
          width={248}
          collapsedWidth={76}
          collapsed={collapsed}
          trigger={null}
        >
          <div className="app-brand">
            <span className="app-brand-mark"><MedicineBoxOutlined /></span>
            {!collapsed && <span className="app-brand-name">安心病历</span>}
          </div>
          <div className="app-nav-caption">工作空间</div>
          <nav aria-label="主导航">
            {navigation.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`app-nav-item${selectedKey === item.key ? ' is-active' : ''}`}
                onClick={() => navigate(item.key)}
                title={collapsed ? item.label : undefined}
              >
                <span className="app-nav-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
          <Button
            type="text"
            className="sider-collapse-button"
            aria-label={collapsed ? '展开导航' : '收起导航'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
          >
            {!collapsed && '收起菜单'}
          </Button>
        </Sider>
      )}
      <Layout className="app-main-layout">
        <Header className="app-header">
          <div className="mobile-wordmark">
            <span className="app-brand-mark"><MedicineBoxOutlined /></span>
            <span>安心病历</span>
          </div>
          <div className="header-spacer" />
          <ThemeToggle className="header-theme-toggle" />
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'identity', disabled: true, label: account?.email ?? '当前账号' },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
              ],
            }}
          >
            <Button type="text" className="account-menu-button">
              <Avatar size={34} icon={<UserOutlined />} />
              <Typography.Text className="account-name" ellipsis>
                {account?.username ?? account?.email ?? '我的账号'}
              </Typography.Text>
            </Button>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <div className="app-content-inner"><Outlet /></div>
        </Content>
      </Layout>
      {mobile && (
        <nav className="mobile-bottom-nav" aria-label="主导航">
          {navigation.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`mobile-nav-item${selectedKey === item.key ? ' is-active' : ''}`}
              aria-current={selectedKey === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </nav>
      )}
    </Layout>
  );
}
