import { useEffect, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Empty,
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
import dayjs, { type Dayjs } from 'dayjs';
import { ArrowLeftOutlined, CalendarOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { getVisit, updateVisit, type DiagnosisRecord, type Medication, type VisitFile } from '@/api/visits';
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
import { deleteFile, readFile, replaceFile, uploadFile } from '@/api/files';
import { extractErrorMessage } from '@/api/client';
import { RecognitionInputActions } from '@/components/RecognitionInputActions';
import { AttachmentScan } from '@/components/AttachmentScan';
import { AttachmentThumbnail } from '@/components/AttachmentThumbnail';
import { PageHeader } from '@/components/PageHeader';

const PREVIEW_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function AttachmentPreview({ file, blob }: { file: VisitFile; blob: Blob }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob.slice(0, blob.size, file.mimeType));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob, file.mimeType]);

  if (!url) return <Spin />;
  if (file.mimeType === 'application/pdf') {
    return <Button href={url} target="_blank" rel="noopener noreferrer">在新标签页打开 PDF</Button>;
  }
  return <img src={url} alt={file.originalName} style={{ maxWidth: '100%', maxHeight: '65vh' }} />;
}

interface RecordFormValues {
  diagnosis: string;
}

interface MedicationFormValues {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

interface VisitFormValues {
  date: Dayjs;
  hospital?: string;
  department?: string;
  doctor?: string;
  note?: string;
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

  const [visitEditOpen, setVisitEditOpen] = useState(false);
  const [visitForm] = Form.useForm<VisitFormValues>();
  const visitUpdateMutation = useMutation({
    mutationFn: (values: VisitFormValues) => updateVisit(id!, {
      date: values.date.toISOString(),
      hospital: values.hospital?.trim() || null,
      department: values.department?.trim() || null,
      doctor: values.doctor?.trim() || null,
      note: values.note?.trim() || null,
    }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['visit', id], updated);
      await queryClient.invalidateQueries({ queryKey: ['visits'] });
      setVisitEditOpen(false);
      message.success('已更新就诊信息');
    },
    onError: (error) => message.error(extractErrorMessage(error, '更新就诊信息失败')),
  });

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
  const [preview, setPreview] = useState<{ file: VisitFile; blob: Blob }>();
  const fileReadMutation = useMutation({
    mutationFn: async ({ file, mode }: { file: VisitFile; mode: 'download' | 'preview' }) => {
      const blob = await readFile(file.id);
      if (mode === 'preview' && file.mimeType === 'application/pdf') {
        if (!(await blob.slice(0, 5).text()).startsWith('%PDF-')) {
          throw new Error('附件内容不是有效的 PDF 文件');
        }
      }
      return { file, mode, blob };
    },
    onSuccess: ({ file, mode, blob }) => {
      if (mode === 'preview') {
        setPreview({ file, blob });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: (error) => message.error(extractErrorMessage(error, '无法获取附件，请重试')),
  });

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
    return <div className="page-loading"><Spin size="large" /></div>;
  }

  if (visitQuery.isError || !visitQuery.data) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/visits')}>
          返回就诊列表
        </Button>
        <Alert showIcon type="error" message="无法载入就诊详情"
          description={extractErrorMessage(visitQuery.error, '加载失败')} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const visit = visitQuery.data;

  return (
    <section className="visit-detail-page">
      <PageHeader
        eyebrow="就诊档案 · 详情"
        title="就诊详情"
        description="查看并维护这次就诊的诊断、用药和相关附件。"
        actions={(
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/visits')}>返回记录</Button>
            <Button type="primary" onClick={() => {
              visitForm.setFieldsValue({
                date: dayjs(visit.date),
                hospital: visit.hospital ?? '',
                department: visit.department ?? '',
                doctor: visit.doctor ?? '',
                note: visit.note ?? '',
              });
              setVisitEditOpen(true);
            }}>编辑就诊</Button>
          </>
        )}
      />

      <Card className="visit-summary-card">
        <div className="visit-summary-head">
          <div className="visit-summary-person">
            <span className="visit-person-avatar">{visit.user?.name?.slice(0, 1) || <UserOutlined />}</span>
            <div className="visit-summary-title">
              <div className="page-eyebrow">家庭成员：{visit.user?.name ?? '未知'}</div>
              <h2>{visit.hospital || '就诊记录'}</h2>
              {visit.department && <p>{visit.department}{visit.doctor ? ` · ${visit.doctor}` : ''}</p>}
            </div>
          </div>
          <div className="visit-summary-date"><CalendarOutlined />{dayjs(visit.date).format('YYYY年M月D日 · HH:mm')}</div>
        </div>
        <div className="visit-meta-grid">
          <div className="visit-meta-item"><span className="visit-meta-label">就诊成员</span><span className="visit-meta-value">{visit.user?.name ?? '未关联'}</span></div>
          <div className="visit-meta-item"><span className="visit-meta-label">医院</span><span className="visit-meta-value">{visit.hospital || '尚未填写'}</span></div>
          <div className="visit-meta-item"><span className="visit-meta-label">科室</span><span className="visit-meta-value">{visit.department || '尚未填写'}</span></div>
          <div className="visit-meta-item"><span className="visit-meta-label">接诊医生</span><span className="visit-meta-value">{visit.doctor || '尚未填写'}</span></div>
        </div>
        {visit.note && (
          <div className="visit-note">
            <div className="visit-note-label">就诊备注</div>
            <div className="visit-note-content">{visit.note}</div>
          </div>
        )}
      </Card>

      <Modal
        className="responsive-modal"
        title="编辑就诊"
        open={visitEditOpen}
        onOk={() => visitForm.submit()}
        onCancel={() => setVisitEditOpen(false)}
        confirmLoading={visitUpdateMutation.isPending}
        cancelButtonProps={{ disabled: visitUpdateMutation.isPending }}
        closable={!visitUpdateMutation.isPending}
        maskClosable={!visitUpdateMutation.isPending}
        keyboard={!visitUpdateMutation.isPending}
        forceRender
        width={760}
      >
        <Form
          form={visitForm}
          layout="vertical"
          className="form-grid"
          disabled={visitUpdateMutation.isPending}
          onFinish={(values) => visitUpdateMutation.mutate(values)}
        >
          <Form.Item label="就诊日期" name="date" rules={[{ required: true, message: '请选择就诊日期' }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item label="医院" name="hospital">
            <Input maxLength={200} placeholder="医院名称" />
          </Form.Item>
          <Form.Item label="科室" name="department">
            <Input maxLength={200} placeholder="例如：心内科" />
          </Form.Item>
          <Form.Item label="医生" name="doctor">
            <Input maxLength={200} placeholder="医生姓名" />
          </Form.Item>
          <Form.Item label="就诊备注" className="form-wide">
            <Form.Item name="note" noStyle>
              <Input.TextArea maxLength={1000} rows={4} showCount placeholder="记录症状、检查结果或其他重要信息" />
            </Form.Item>
            {visitEditOpen && <RecognitionInputActions
              getCurrentText={() => visitForm.getFieldValue('note')}
              onText={(note) => visitForm.setFieldValue('note', note)}
            />}
          </Form.Item>
        </Form>
      </Modal>

      <Card
        className="section-card"
        title={<div className="page-section-title">诊断 <Tag>{visit.records?.length ?? 0}</Tag></div>}
        extra={
          <Button size="small" type="primary" onClick={openRecordCreate}>
            新增
          </Button>
        }
      >
        <List<DiagnosisRecord>
          dataSource={visit.records ?? []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无诊断记录" /> }}
          renderItem={(record) => (
            <List.Item
              className="record-list-item"
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
              <div className="record-list-content">{record.diagnosis}</div>
            </List.Item>
          )}
        />
      </Card>

      <Card
        className="section-card"
        title={<div className="page-section-title">用药 <Tag>{visit.medications?.length ?? 0}</Tag></div>}
        extra={
          <Button size="small" type="primary" onClick={openMedicationCreate}>
            新增
          </Button>
        }
      >
        <List<Medication>
          dataSource={visit.medications ?? []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无用药记录" /> }}
          renderItem={(medication) => (
            <List.Item
              className="record-list-item"
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
              <Space className="medication-list-content" size="small" wrap>
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
        className="section-card"
        title={<div className="page-section-title">检查附件 <Tag>{visit.files?.length ?? 0}</Tag></div>}
        extra={
          <Space wrap>
            <Upload {...uploadProps}>
              <Button size="small" type="primary" icon={<UploadOutlined />}>添加附件</Button>
            </Upload>
            <AttachmentScan key={visit.id} onUpload={async (file) => {
              await uploadFile(visit.id, file);
              invalidate();
            }} />
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" className="attachment-hint">
          支持 PDF、JPG、PNG、WebP，单个文件最大 10 MB。
        </Typography.Paragraph>
        <List<VisitFile>
          dataSource={visit.files ?? []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无检查附件" /> }}
          renderItem={(file) => (
            <List.Item
              className="file-list-item"
              actions={[
                <Button key="download" size="small" disabled={fileReadMutation.isPending}
                  onClick={() => fileReadMutation.mutate({ file, mode: 'download' })}>
                  下载
                </Button>,
                ...(PREVIEW_TYPES.has(file.mimeType) ? [
                  <Button key="preview" size="small" disabled={fileReadMutation.isPending}
                    onClick={() => fileReadMutation.mutate({ file, mode: 'preview' })}>
                    预览
                  </Button>,
                ] : []),
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
              <div className="file-list-content">
                <AttachmentThumbnail key={file.storedName} file={file}
                  onPreview={() => fileReadMutation.mutate({ file, mode: 'preview' })} />
                <div className="file-details">
                  <Typography.Text className="file-name">{file.originalName}</Typography.Text>
                  <div className="file-meta">
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                    <span>{file.mimeType}</span>
                    <span>上传于 {dayjs(file.createdAt).format('YYYY-MM-DD')}</span>
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Modal className="responsive-modal" open={!!preview} title={preview?.file.originalName} footer={null}
        onCancel={() => setPreview(undefined)}>
        {preview && <AttachmentPreview file={preview.file} blob={preview.blob} />}
      </Modal>

      <Modal
        className="responsive-modal"
        title={recordModal.editing ? '编辑诊断' : '新增诊断'}
        open={recordModal.open}
        onOk={submitRecord}
        onCancel={() => setRecordModal({ open: false, editing: null })}
        confirmLoading={recordCreateMutation.isPending || recordUpdateMutation.isPending}
        cancelButtonProps={{ disabled: recordCreateMutation.isPending || recordUpdateMutation.isPending }}
        destroyOnHidden
        width={640}
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
            <Input.TextArea rows={5} showCount maxLength={1000} placeholder="输入诊断内容或使用下方识别工具" />
          </Form.Item>
          {recordModal.open && <RecognitionInputActions
            key={recordModal.editing?.id ?? "new"}
            getCurrentText={() => recordForm.getFieldValue('diagnosis')}
            onText={(diagnosis) => recordForm.setFieldValue('diagnosis', diagnosis)}
          />}
        </Form>
      </Modal>

      <Modal
        className="responsive-modal"
        title={medicationModal.editing ? '编辑用药' : '新增用药'}
        open={medicationModal.open}
        onOk={submitMedication}
        onCancel={() => setMedicationModal({ open: false, editing: null })}
        confirmLoading={
          medicationCreateMutation.isPending || medicationUpdateMutation.isPending
        }
        destroyOnHidden
        width={640}
      >
        <Form form={medicationForm} layout="vertical" className="form-grid">
          <Form.Item
            label="药品名称"
            name="name"
            rules={[
              { required: true, message: '请输入药品名称' },
              { max: 200, message: '名称不能超过 200 字' },
            ]}
          >
            <Input placeholder="药品名称" />
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
    </section>
  );
}
