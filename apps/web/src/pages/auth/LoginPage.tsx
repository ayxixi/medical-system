import { useState } from 'react';
import { Button, Card, Form, Input, Typography, App as AntdApp } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login, type LoginPayload } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/auth';

interface LocationState {
  from?: string;
}

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: 380, maxWidth: "calc(100% - 24px)" }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          登录
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} autoComplete="on">
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="you@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password placeholder="至少 8 位" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form.Item>
          <Typography.Paragraph style={{ textAlign: 'center', margin: 0 }}>
            还没有账号？ <Link to="/register">立即注册</Link>
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  );
}
