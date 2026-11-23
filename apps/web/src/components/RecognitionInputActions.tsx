import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, App as AntdApp, Button, Input, Radio, Space, Typography } from 'antd';
import { AudioOutlined, CameraOutlined, StopOutlined } from '@ant-design/icons';
import { extractErrorMessage } from '@/api/client';
import { recognizeImage, transcribeAudio } from '@/api/recognition';

interface Props {
  getCurrentText: () => string | undefined;
  onText: (text: string) => void;
  disabled?: boolean;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 4096;

async function prepareImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1 && file.size <= MAX_IMAGE_BYTES &&
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理图片，请改用 JPEG 或 PNG。');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('图片过大，请裁剪后重试。');
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ImageSource = 'camera' | 'album';
type PendingAction = ImageSource | 'microphone' | 'transcription';
type FillMode = 'append' | 'replace';

const MAX_RECORDING_MS = 60_000;

export function RecognitionInputActions({ getCurrentText, onText, disabled = false }: Props) {
  const { message } = AntdApp.useApp();
  const [failure, setFailure] = useState<string>();
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [recognizedText, setRecognizedText] = useState('');
  const [fillMode, setFillMode] = useState<FillMode>('append');
  const busy = pendingAction !== undefined;
  const [recording, setRecording] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stopTimer = useRef<number | undefined>(undefined);

  const lifetime = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      const activeRecorder = recorder.current;
      if (activeRecorder) {
        activeRecorder.onstop = null;
        activeRecorder.onerror = null;
        activeRecorder.ondataavailable = null;
        if (activeRecorder.state !== 'inactive') activeRecorder.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const previewText = (text: string) => {
    const recognized = text.trim();
    if (!recognized) {
      message.warning('没有识别到文字，请手动输入或换一份媒体。');
      return;
    }
    setRecognizedText(recognized);
    setFillMode('append');
  };

  const currentText = getCurrentText()?.trim() ?? '';
  const combinedText = fillMode === 'replace'
    ? recognizedText
    : [currentText, recognizedText].filter(Boolean).join('\n');
  const previewTooLong = recognizedText.length > 1000;
  const confirmFill = () => {
    if (previewTooLong || combinedText.length > 1000) return;
    onText(combinedText);
    setRecognizedText('');
    message.success('内容已填入表单，可继续修改后保存。');
  };

  const runImage = async (source: ImageSource, file?: File) => {
    const signal = lifetime.current?.signal;
    if (!file || !signal || signal.aborted) return;
    setFailure(undefined);
    setPendingAction(source);
    try {
      const prepared = await prepareImage(file).catch((error: unknown) => {
        if (error instanceof DOMException) throw new Error('无法读取这张图片，请改用 JPEG 或 PNG。');
        throw error;
      });
      if (signal.aborted) return;
      const text = await recognizeImage(prepared, signal);
      if (!signal.aborted) previewText(text);
    } catch (error) {
      if (!signal.aborted) setFailure(extractErrorMessage(error, '图片识别失败，可继续手动录入。'));
    } finally {
      if (!signal.aborted) setPendingAction(undefined);
    }
  };

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>, source: ImageSource) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    void runImage(source, file);
  };

  const uploadRecording = async (blob: Blob, signal: AbortSignal) => {
    if (signal.aborted) return;
    if (!blob.size) {
      message.warning('录音为空，请重新录制。');
      return;
    }
    if (blob.size > 10 * 1024 * 1024) {
      message.error('录音超过 10 MB，请缩短后重试。');
      return;
    }
    setFailure(undefined);
    setPendingAction('transcription');
    try {
      const text = await transcribeAudio(blob, signal);
      if (!signal.aborted) previewText(text);
    } catch (error) {
      if (!signal.aborted) setFailure(extractErrorMessage(error, '语音转写失败，可继续手动录入。'));
    } finally {
      if (!signal.aborted) setPendingAction(undefined);
    }
  };

  const stopRecording = () => {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = undefined;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const startRecording = async () => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      message.error('当前浏览器不支持录音，请使用 HTTPS 或选择支持录音的浏览器。');
      return;
    }
    setPendingAction('microphone');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (signal.aborted) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mediaStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const activeRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);
      chunks.current = [];
      recorder.current = activeRecorder;
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      activeRecorder.onerror = () => {
        window.clearTimeout(stopTimer.current);
        stopTimer.current = undefined;
        activeRecorder.onstop = null;
        mediaStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        setRecording(false);
        message.error('录音失败，请重试或手动录入。');
      };
      activeRecorder.onstop = () => {
        const contentType = (activeRecorder.mimeType || 'audio/webm').split(';')[0];
        const recordingBlob = new Blob(chunks.current, { type: contentType });
        chunks.current = [];
        mediaStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        setRecording(false);
        void uploadRecording(recordingBlob, signal);
      };
      activeRecorder.start();
      setRecording(true);
      stopTimer.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (!signal.aborted) message.error('无法访问麦克风，请检查浏览器权限或继续手动录入。');
    } finally {
      if (!signal.aborted) setPendingAction(undefined);
    }
  };

  return (
    <Space direction="vertical" size={8} className="recognition-actions">
      <Typography.Text strong>拍照、选图或语音录入</Typography.Text>
      <Space wrap className="recognition-actions-main">
        <input ref={imageInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(event) => selectImage(event, 'album')} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(event) => selectImage(event, 'camera')} />
        <Button
          htmlType="button"
          icon={<CameraOutlined />}
          disabled={disabled || busy || recording}
          loading={pendingAction === 'camera'}
          onClick={() => cameraInput.current?.click()}
        >
          拍照识别
        </Button>
        <Button
          htmlType="button"
          disabled={disabled || busy || recording}
          loading={pendingAction === 'album'}
          onClick={() => imageInput.current?.click()}
        >
          从相册选图
        </Button>
        {recording ? (
          <Button htmlType="button" size="small" danger icon={<StopOutlined />} onClick={stopRecording}>
            停止并转写
          </Button>
        ) : (
          <Button
            htmlType="button"
            size="small"
            icon={<AudioOutlined />}
            disabled={disabled || busy}
            loading={pendingAction === 'microphone' || pendingAction === 'transcription'}
            onClick={() => void startRecording()}
          >
            录音转文字
          </Button>
        )}
      </Space>
      {failure && <Alert type="error" message={failure} showIcon />}
      {recognizedText && (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text strong>识别结果预览</Typography.Text>
          <Input.TextArea
            aria-label="识别结果预览"
            value={recognizedText}
            onChange={(event) => setRecognizedText(event.target.value)}
            autoSize={{ minRows: 3, maxRows: 8 }}
          />
          <Radio.Group
            aria-label="填入方式"
            value={fillMode}
            onChange={(event) => setFillMode(event.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="append">追加到现有内容</Radio.Button>
            <Radio.Button value="replace">替换现有内容</Radio.Button>
          </Radio.Group>
          <Typography.Text type={previewTooLong || combinedText.length > 1000 ? 'danger' : 'secondary'}>
            {fillMode === 'append' ? '追加后' : '替换后'}：{combinedText.length} / 1000 字
          </Typography.Text>
          {(previewTooLong || combinedText.length > 1000) && (
            <Alert type="warning" showIcon message="内容超过 1000 字。请编辑识别结果或选择替换后再填入。" />
          )}
          <Space>
            <Button type="primary" disabled={previewTooLong || combinedText.length > 1000} onClick={confirmFill}>
              确认填入
            </Button>
            <Button onClick={() => setRecognizedText('')}>取消</Button>
          </Space>
        </Space>
      )}
      {busy && <Typography.Text role="status">正在处理媒体并识别，请稍候…</Typography.Text>}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        照片和录音仅用于识别。识别结果可修改，随表单保存。录音最长 60 秒，识别上传上限 10 MB。
      </Typography.Text>
    </Space>
  );
}
