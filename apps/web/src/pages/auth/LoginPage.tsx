import { useState } from 'react';
import { App as AntdApp, Button, Form, Input } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login, type LoginPayload } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { AuthShell } from '@/components/AuthShell';
import { useAuthStore } from '@/store/auth';

interface LocationState { from?: string; }

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as LocationState | null)?.from ?? '/';

  const onFinish = async (values: LoginPayload) => {
    setSubmitting(true);
    try {
      const result = await login(values);
      setSession(result.accessToken, result.account);
      message.success('登录成功');
      navigate(from, { replace: true });
    } catch (error) {
      message.error(extractErrorMessage(error, '登录失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="登录"
      description="登录后继续查看和整理家庭健康资料。"
      footer={<>还没有账号？ <Link to="/register">创建新账号</Link></>}
    >
      <Form layout="vertical" onFinish={onFinish} autoComplete="on" requiredMark={false}>
        <Form.Item
          label="用户名或邮箱"
          name="identifier"
          rules={[{ required: true, message: '请输入用户名或邮箱' }]}
        >
          <Input size="large" placeholder="输入用户名或邮箱" autoComplete="username" />
        </Form.Item>
        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}
        >
          <Input.Password size="large" placeholder="至少 8 位" autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          登录
        </Button>
      </Form>
    </AuthShell>
  );
}
