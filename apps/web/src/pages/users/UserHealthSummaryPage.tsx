import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, List, Row, Space, Spin, Statistic, Tag, Typography } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { extractErrorMessage } from '@/api/client';
import { getUserHealthSummary } from '@/api/userSummary';
import { PageHeader } from '@/components/PageHeader';

const logLabels: Record<string, string> = {
  temperature: '体温', medication: '服药', symptom: '症状', note: '日常情况',
};

function details(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(' · ');
}

export default function UserHealthSummaryPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['user-health-summary', id],
    queryFn: () => getUserHealthSummary(id),
    enabled: Boolean(id),
  });

  if (query.isPending) return <div className="page-loading"><Spin size="large" /></div>;
  if (query.isError) return <section>
    <PageHeader title="健康摘要" actions={<Button icon={<LeftOutlined />} onClick={() => navigate('/users')}>返回成员</Button>} />
    <Alert type="error" showIcon message="健康摘要加载失败" description={extractErrorMessage(query.error)} action={<Button onClick={() => void query.refetch()}>重试</Button>} />
  </section>;
  if (!query.data) return null;

  const summary = query.data;
  return <section>
    <PageHeader
      eyebrow="家庭档案 · 健康摘要"
      title={summary.name}
      description={`成员档案创建于 ${dayjs(summary.createdAt).format('YYYY年M月D日')}。以下内容汇总现有记录，未产生新的病历。`}
      actions={<Button icon={<LeftOutlined />} onClick={() => navigate('/users')}>返回成员</Button>}
    />

    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={8}><Card><Statistic title="就诊" value={summary._count.visits} suffix="次" /></Card></Col>
      <Col xs={8}><Card><Statistic title="日常记录" value={summary._count.healthLogs} suffix="条" /></Card></Col>
      <Col xs={8}><Card><Statistic title="有效提醒" value={summary._count.reminders} suffix="个" /></Card></Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card title="最近就诊" extra={<Typography.Text type="secondary">最近 5 次</Typography.Text>}>
          {summary.visits.length ? <List
            dataSource={summary.visits}
            rowKey="id"
            renderItem={(visit) => <List.Item>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Space wrap>
                  <Typography.Text strong>{dayjs(visit.date).format('YYYY年M月D日')}</Typography.Text>
                  {(visit.hospital || visit.department) && <Typography.Text type="secondary">{details([visit.hospital, visit.department])}</Typography.Text>}
                  <Button type="link" size="small" onClick={() => navigate(`/visits/${visit.id}`)}>查看就诊</Button>
                </Space>
                {visit.records.length > 0 && <Typography.Text>诊断：{visit.records.map((record) => record.diagnosis).join('；')}</Typography.Text>}
                {visit.medications.length > 0 && <Typography.Text type="secondary">用药：{visit.medications.map((medicine) => details([medicine.name, medicine.dosage, medicine.frequency])).join('；')}</Typography.Text>}
                {!visit.records.length && !visit.medications.length && <Typography.Text type="secondary">尚无诊断或用药资料</Typography.Text>}
              </Space>
            </List.Item>}
          /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无就诊记录" />}
        </Card>

        <Card title="近期日常记录" extra={<Typography.Text type="secondary">最近 10 条</Typography.Text>} style={{ marginTop: 16 }}>
          {summary.healthLogs.length ? <List
            dataSource={summary.healthLogs}
            rowKey="id"
            renderItem={(log) => {
              const content = details([
                log.temperature === null ? null : `${log.temperature.toFixed(1)}°C`,
                log.medicineName && details([log.medicineName, log.dosage]),
                log.symptoms,
                log.note,
              ]);
              return <List.Item>
                <Space direction="vertical" size={5} style={{ width: '100%' }}>
                  <Space wrap><Tag color={log.type === 'temperature' ? 'volcano' : 'blue'}>{logLabels[log.type] ?? log.type}</Tag><Typography.Text type="secondary">{dayjs(log.occurredAt).format('YYYY年M月D日 HH:mm')}</Typography.Text></Space>
                  <Typography.Text>{content || '未填写详细内容'}</Typography.Text>
                </Space>
              </List.Item>;
            }}
          /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日常记录" />}
        </Card>
      </Col>

      <Col xs={24} xl={10}>
        <Card title="有效提醒" extra={<Typography.Text type="secondary">最近 5 个</Typography.Text>}>
          {summary.reminders.length ? <List
            dataSource={summary.reminders}
            rowKey="id"
            renderItem={(reminder) => <List.Item>
              <Space direction="vertical" size={4}>
                <Typography.Text strong>{reminder.title}</Typography.Text>
                <Typography.Text type="secondary">
                  {dayjs(reminder.nextAt).format('YYYY年M月D日 HH:mm')}{reminder.repeatDaily ? ' · 每日重复' : ''}
                </Typography.Text>
              </Space>
            </List.Item>}
          /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有有效提醒" />}
          <Button type="link" onClick={() => navigate('/health-logs')}>打开西西记录</Button>
        </Card>
      </Col>
    </Row>
  </section>;
}
