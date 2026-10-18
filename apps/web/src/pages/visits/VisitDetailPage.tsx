import { useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { getVisit, type DiagnosisRecord, type Medication, type VisitFile } from '@/api/visits';
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from '@/api/records';
import {
  createMedication,
  deleteMedication,
  updateMedication,
  type CreateMedicationPayload,
  type UpdateMedicationPayload,
} from '@/api/medications';
import { deleteFile, replaceFile, uploadFile } from '@/api/files';
import { extractErrorMessage } from '@/api/client';

interface RecordFormValues {
  diagnosis: string;
}

interface MedicationFormValues {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const visitQuery = useQuery({
    queryKey: ['visit', id],
    queryFn: () => getVisit(id!),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['visit', id] });

  // Diagnosis records
  const [recordModal, setRecordModal] = useState<{ open: boolean; editing: DiagnosisRecord | null }>(
    { open: false, editing: null },
  );
  const [recordForm] = Form.useForm<RecordFormValues>();

  const recordCreateMutation = useMutation({
    mutationFn: (values: RecordFormValues) => createRecord({ visitId: id!, ...values }),
    onSuccess: () => {
      message.success('已新增诊断');
      setRecordModal({ open: false, editing: null });
      recordForm.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '操作失败')),
  });

  const recordUpdateMutation = useMutation({
    mutationFn: (input: { id: string; values: RecordFormValues }) =>
      updateRecord(input.id, input.values),
    onSuccess: () => {
      message.success('已更新诊断');
      setRecordModal({ open: false, editing: null });
      recordForm.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '操作失败')),
  });

  const recordDeleteMutation = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => {
      message.success('已删除诊断');
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const openRecordCreate = () => {
    setRecordModal({ open: true, editing: null });
    recordForm.resetFields();
  };

  const openRecordEdit = (record: DiagnosisRecord) => {
    setRecordModal({ open: true, editing: record });
    recordForm.setFieldsValue({ diagnosis: record.diagnosis });
  };

  const submitRecord = async () => {
    const values = await recordForm.validateFields();
    if (recordModal.editing) {
      recordUpdateMutation.mutate({ id: recordModal.editing.id, values });
    } else {
      recordCreateMutation.mutate(values);
    }
  };

  // Medications
  const [medicationModal, setMedicationModal] = useState<{
    open: boolean;
    editing: Medication | null;
  }>({ open: false, editing: null });
  const [medicationForm] = Form.useForm<MedicationFormValues>();

  const medicationCreateMutation = useMutation({
    mutationFn: (payload: CreateMedicationPayload) => createMedication(payload),
    onSuccess: () => {
      message.success('已新增用药');
      setMedicationModal({ open: false, editing: null });
      medicationForm.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '操作失败')),
  });

  const medicationUpdateMutation = useMutation({
    mutationFn: (input: { id: string; values: UpdateMedicationPayload }) =>
      updateMedication(input.id, input.values),
    onSuccess: () => {
      message.success('已更新用药');
      setMedicationModal({ open: false, editing: null });
      medicationForm.resetFields();
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '操作失败')),
  });

  const medicationDeleteMutation = useMutation({
    mutationFn: deleteMedication,
    onSuccess: () => {
      message.success('已删除用药');
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const openMedicationCreate = () => {
    setMedicationModal({ open: true, editing: null });
    medicationForm.resetFields();
  };

  const openMedicationEdit = (medication: Medication) => {
    setMedicationModal({ open: true, editing: medication });
    medicationForm.setFieldsValue({
      name: medication.name,
      dosage: medication.dosage ?? undefined,
      frequency: medication.frequency ?? undefined,
      duration: medication.duration ?? undefined,
    });
  };

  const submitMedication = async () => {
    const values = await medicationForm.validateFields();
    if (medicationModal.editing) {
      medicationUpdateMutation.mutate({ id: medicationModal.editing.id, values });
    } else {
      medicationCreateMutation.mutate({ visitId: id!, ...values });
    }
  };

  // Files
  const fileDeleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      message.success('已删除附件');
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '删除失败')),
  });

  const fileReplaceMutation = useMutation({
    mutationFn: (input: { id: string; file: File }) => replaceFile(input.id, input.file),
    onSuccess: () => {
      message.success('已替换附件');
      invalidate();
    },
    onError: (error) => message.error(extractErrorMessage(error, '替换失败')),
  });

  const uploadProps: UploadProps = {
    multiple: false,
    showUploadList: false,
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        await uploadFile(id!, file as File);
        message.success('上传成功');
        invalidate();
        onSuccess?.({}, new XMLHttpRequest());
      } catch (error) {
        message.error(extractErrorMessage(error, '上传失败'));
        onError?.(error as Error);
      }
    },
  };

  const buildReplaceUploadProps = (fileId: string): UploadProps => ({
    multiple: false,
    showUploadList: false,
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        await fileReplaceMutation.mutateAsync({ id: fileId, file: file as File });
        onSuccess?.({}, new XMLHttpRequest());
      } catch (error) {
        onError?.(error as Error);
      }
    },
  });

  if (visitQuery.isLoading) {
    return <Spin />;
  }

  if (visitQuery.isError || !visitQuery.data) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/visits')}>
          返回就诊列表
        </Button>
        <Typography.Paragraph style={{ marginTop: 16 }}>
          {extractErrorMessage(visitQuery.error, '加载失败')}
        </Typography.Paragraph>
      </div>
    );
  }

  const visit = visitQuery.data;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/visits')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          就诊详情
        </Typography.Title>
      </Space>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="成员">{visit.user?.name ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="就诊日期">
          {dayjs(visit.date).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="医院">{visit.hospital ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="科室">{visit.department ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="医生">{visit.doctor ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="备注" span={2}>
          {visit.note ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <Card
        title="诊断"
        style={{ marginBottom: 16 }}
        extra={
          <Button size="small" type="primary" onClick={openRecordCreate}>
            新增
          </Button>
        }
      >
        <List<DiagnosisRecord>
          dataSource={visit.records ?? []}
          locale={{ emptyText: '暂无诊断' }}
          renderItem={(record) => (
            <List.Item
              actions={[
                <Button key="edit" size="small" onClick={() => openRecordEdit(record)}>
                  编辑
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确认删除？"
                  okType="danger"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => recordDeleteMutation.mutate(record.id)}
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Typography.Text>{record.diagnosis}</Typography.Text>
            </List.Item>
          )}
        />
      </Card>

      <Card
        title="用药"
        style={{ marginBottom: 16 }}
        extra={
          <Button size="small" type="primary" onClick={openMedicationCreate}>
            新增
          </Button>
        }
      >
        <List<Medication>
          dataSource={visit.medications ?? []}
          locale={{ emptyText: '暂无用药' }}
          renderItem={(medication) => (
            <List.Item
              actions={[
                <Button key="edit" size="small" onClick={() => openMedicationEdit(medication)}>
                  编辑
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确认删除？"
                  okType="danger"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => medicationDeleteMutation.mutate(medication.id)}
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Space size="middle" wrap>
                <Typography.Text strong>{medication.name}</Typography.Text>
                {medication.dosage && <Tag>{medication.dosage}</Tag>}
                {medication.frequency && <Tag color="blue">{medication.frequency}</Tag>}
                {medication.duration && <Tag color="purple">{medication.duration}</Tag>}
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card
        title="附件"
        extra={
          <Upload {...uploadProps}>
            <Button size="small" type="primary" icon={<UploadOutlined />}>
              上传文件
            </Button>
          </Upload>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          支持 PDF / JPG / PNG / WebP，最大 10MB。
        </Typography.Paragraph>
        <List<VisitFile>
          dataSource={visit.files ?? []}
          locale={{ emptyText: '暂无附件' }}
          renderItem={(file) => (
            <List.Item
              actions={[
                <Upload key="replace" {...buildReplaceUploadProps(file.id)}>
                  <Button size="small" loading={fileReplaceMutation.isPending}>
                    替换
                  </Button>
                </Upload>,
                <Popconfirm
                  key="delete"
                  title="确认删除该附件？"
                  okType="danger"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => fileDeleteMutation.mutate(file.id)}
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Space>
                <Typography.Text>{file.originalName}</Typography.Text>
                <Tag>{(file.size / 1024).toFixed(1)} KB</Tag>
                <Tag color="geekblue">{file.mimeType}</Tag>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={recordModal.editing ? '编辑诊断' : '新增诊断'}
        open={recordModal.open}
        onOk={submitRecord}
        onCancel={() => setRecordModal({ open: false, editing: null })}
        confirmLoading={recordCreateMutation.isPending || recordUpdateMutation.isPending}
        destroyOnHidden
      >
        <Form form={recordForm} layout="vertical">
          <Form.Item
            label="诊断内容"
            name="diagnosis"
            rules={[
              { required: true, message: '请输入诊断' },
              { max: 1000, message: '诊断不能超过 1000 字' },
            ]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={medicationModal.editing ? '编辑用药' : '新增用药'}
        open={medicationModal.open}
        onOk={submitMedication}
        onCancel={() => setMedicationModal({ open: false, editing: null })}
        confirmLoading={
          medicationCreateMutation.isPending || medicationUpdateMutation.isPending
        }
        destroyOnHidden
      >
        <Form form={medicationForm} layout="vertical">
          <Form.Item
            label="药品名称"
            name="name"
            rules={[
              { required: true, message: '请输入药品名称' },
              { max: 200, message: '名称不能超过 200 字' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="剂量" name="dosage">
            <Input maxLength={100} placeholder="例如：500mg" />
          </Form.Item>
          <Form.Item label="频次" name="frequency">
            <Input maxLength={100} placeholder="例如：每日 3 次" />
          </Form.Item>
          <Form.Item label="疗程" name="duration">
            <Input maxLength={100} placeholder="例如：连续 7 天" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
