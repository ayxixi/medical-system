import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './queryClient';
import { useThemeStore } from './store/theme';

export default function AppRoot() {
  const mode = useThemeStore((state) => state.mode);
  const dark = mode === 'dark';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: dark ? '#53c4b3' : '#137d74',
          colorInfo: dark ? '#53c4b3' : '#137d74',
          colorSuccess: dark ? '#5fc29b' : '#25856e',
          colorBgBase: dark ? '#111a1b' : '#ffffff',
          colorBgLayout: dark ? '#111a1b' : '#f4f7f7',
          colorBgContainer: dark ? '#1b2728' : '#ffffff',
          colorText: dark ? '#e3eeee' : '#203238',
          colorTextSecondary: dark ? '#9aabab' : '#73858a',
          colorBorder: dark ? '#344344' : '#e2eae8',
          colorBorderSecondary: dark ? '#2b393a' : '#edf1f0',
          borderRadius: 10,
          controlHeight: 40,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
