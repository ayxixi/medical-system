import { useState } from 'react';
import { Button, Card, Form, Input, Typography, App as AntdApp } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { register, type RegisterPayload } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: RegisterPayload) => {
    setSubmitting(true);
    try {
      const result = await register(values);
      setSession(result.accessToken, result.account);
      message.success('注册成功');
      navigate('/', { replace: true });
    } catch (error) {
      message.error(extractErrorMessage(error, '注册失败'));
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
          注册
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} autoComplete="on">
          <Form.Item
            label="姓名"
            name="name"
            rules={[
              { required: true, message: '请输入姓名' },
              { max: 100, message: '姓名长度不能超过 100' },
            ]}
          >
            <Input placeholder="第一个家庭成员的姓名" autoComplete="name" />
          </Form.Item>
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
            <Input.Password placeholder="至少 8 位" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              注册
            </Button>
          </Form.Item>
          <Typography.Paragraph style={{ textAlign: 'center', margin: 0 }}>
            已有账号？ <Link to="/login">直接登录</Link>
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  );
}
