import { useState } from 'react';
import {
  App as AntdApp,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type User,
} from '@/api/users';
import { extractErrorMessage } from '@/api/client';

interface UserFormValues {
  name: string;
}

export default function UsersPage() {
  const { message, modal } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<UserFormValues>();

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });

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
    mutationFn: (input: { id: string; name: string }) =>
      updateUser(input.id, { name: input.name }),
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
    onSuccess: () => {
      message.success('已删除成员');
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    form.resetFields();
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
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: values.name });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleDelete = (user: User) => {
    modal.confirm({
      title: `确认删除成员 “${user.name}”？`,
      content: '该成员名下的所有就诊与附件都会一并删除，且不可恢复。',
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(user.id),
    });
  };

  return (
    <div>
      <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          家庭成员
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增成员
        </Button>
      </Space>
      <Table<User>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: '姓名', dataIndex: 'name' },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            render: (value: string) => new Date(value).toLocaleString('zh-CN'),
          },
          {
            title: '操作',
            key: 'actions',
            width: 160,
            render: (_, record) => (
              <Space>
                <Button size="small" onClick={() => openEdit(record)}>
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除？"
                  okType="danger"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => handleDelete(record)}
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? '编辑成员' : '新增成员'}
        open={creating || !!editing}
        onOk={onSubmit}
        onCancel={closeModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="姓名"
            name="name"
            rules={[
              { required: true, message: '请输入姓名' },
              { max: 100, message: '姓名长度不能超过 100' },
            ]}
          >
            <Input placeholder="例如：张三" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
