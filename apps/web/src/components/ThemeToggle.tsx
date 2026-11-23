import { Button, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useThemeStore } from '@/store/theme';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const nextMode = mode === 'light' ? 'dark' : 'light';
  const label = nextMode === 'dark' ? '切换到深色主题' : '切换到浅色主题';

  return (
    <Tooltip title={label}>
      <Button
        type="text"
        shape="circle"
        className={className}
        aria-label={label}
        title={label}
        icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
        onClick={() => setMode(nextMode)}
      />
    </Tooltip>
  );
}
