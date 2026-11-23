import { useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Spin,
  Typography,
} from 'antd';
import { EditOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, listUsers, updateUser, type User } from '@/api/users';
import { extractErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';

interface UserFormValues { name: string; }

export default function UsersPage() {
  const { message, modal } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<UserFormValues>();

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      message.success('已新增成员');
      setCreating(false);
      form.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '新增失败')),
  });
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name: string }) => updateUser(input.id, { name: input.name }),
    onSuccess: () => {
      message.success('已更新成员');
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '更新失败')),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { message.success('已删除成员'); invalidate(); },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setCreating(true);
  };
  const openEdit = (user: User) => {
    setCreating(false);
    setEditing(user);
    form.setFieldsValue({ name: user.name });
  };
  const closeModal = () => {
    setCreating(false);
    setEditing(null);
    form.resetFields();
  };
  const onSubmit = async () => {
    const values = await form.validateFields();
    if (editing) updateMutation.mutate({ id: editing.id, name: values.name });
    else createMutation.mutate(values);
  };
  const confirmDelete = (user: User) => {
    modal.confirm({
      title: `确认删除成员“${user.name}”？`,
      content: '该成员名下的就诊记录和附件也会一并删除，且无法恢复。',
      okType: 'danger',
      okText: '确认删除',
      cancelText: '保留成员',
      onOk: () => deleteMutation.mutateAsync(user.id),
    });
  };

  return (
    <section>
      <PageHeader
        eyebrow="家庭档案"
        title="家庭成员"
        description="为每位家人分别整理就诊、诊断、用药和检查资料。"
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增成员</Button>}
      />

      {usersQuery.isError && (
        <Alert
          showIcon
          type="error"
          message="成员列表加载失败"
          description={extractErrorMessage(usersQuery.error)}
          action={<Button size="small" onClick={() => void usersQuery.refetch()}>重试</Button>}
          style={{ marginBottom: 18 }}
        />
      )}

      {usersQuery.isLoading ? (
        <div className="page-loading"><Spin size="large" /></div>
      ) : usersQuery.data?.length ? (
        <div className="member-grid">
          {usersQuery.data.map((user) => (
            <Card key={user.id} className="member-card">
              <div className="member-avatar" aria-hidden="true">
                {user.name.trim().slice(0, 1) || <UserOutlined />}
              </div>
              <div className="member-card-main">
                <div className="member-card-heading">
                  <Typography.Title level={4} className="member-card-name">{user.name}</Typography.Title>
                  <div className="member-card-actions">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={`编辑${user.name}`}
                      onClick={() => openEdit(user)}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      aria-label={`删除${user.name}`}
                      onClick={() => confirmDelete(user)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
                <div className="member-card-meta">
                  已加入 · {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="empty-card">
          <Empty description="还没有家庭成员档案">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加第一位成员</Button>
          </Empty>
        </Card>
      )}

      <Modal
        className="responsive-modal"
        title={editing ? '编辑成员资料' : '新增家庭成员'}
        open={creating || !!editing}
        onOk={onSubmit}
        onCancel={closeModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        cancelButtonProps={{ disabled: createMutation.isPending || updateMutation.isPending }}
        destroyOnHidden
        width={520}
      >
        <Typography.Paragraph type="secondary">
          成员资料用于区分不同家庭成员的就诊记录。
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label="姓名或称呼"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }, { max: 100, message: '姓名长度不能超过 100' }]}
          >
            <Input autoFocus placeholder="例如：张三" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
