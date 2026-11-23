import { useState } from 'react';
import { App as AntdApp, Button, Form, Input } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { register, type RegisterPayload } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { AuthShell } from '@/components/AuthShell';
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
    <AuthShell
      title="注册"
      description="先设置账号信息，再开始记录家人的就诊资料。"
      footer={<>已经注册过？ <Link to="/login">返回登录</Link></>}
    >
      <Form layout="vertical" onFinish={onFinish} autoComplete="on" requiredMark={false}>
        <Form.Item
          label="登录用户名"
          name="username"
          rules={[
            { required: true, message: '请设置用户名' },
            { min: 3, max: 32, message: '用户名长度为 3 至 32 位' },
            { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: '以字母或数字开头，可使用点、下划线和连字符' },
          ]}
        >
          <Input size="large" placeholder="用于登录，例如 litao" autoComplete="username" />
        </Form.Item>
        <Form.Item
          label="首位家庭成员姓名"
          name="name"
          rules={[{ required: true, message: '请输入姓名' }, { max: 100, message: '姓名长度不能超过 100' }]}
        >
          <Input size="large" placeholder="例如：张三" autoComplete="name" />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
        >
          <Input size="large" placeholder="用于账号联系和找回" autoComplete="email" />
        </Form.Item>
        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}
        >
          <Input.Password size="large" placeholder="至少 8 位" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="邀请码"
          name="inviteCode"
          extra="如果部署管理员启用了邀请注册，请填写管理员提供的邀请码；本地开放注册时可留空。"
        >
          <Input size="large" placeholder="如有邀请码，请输入" autoComplete="off" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          创建账号
        </Button>
      </Form>
    </AuthShell>
  );
}
