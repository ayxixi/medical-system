import { useEffect, useRef, useState } from 'react';
import { App as AntdApp, Button, Space, Typography } from 'antd';
import { AudioOutlined, CameraOutlined, StopOutlined } from '@ant-design/icons';
import { extractErrorMessage } from '@/api/client';
import { recognizeImage, transcribeAudio } from '@/api/recognition';

interface Props {
  currentText?: string;
  onText: (text: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_MS = 60_000;

export function RecognitionInputActions({ currentText = '', onText, disabled = false }: Props) {
  const { message } = AntdApp.useApp();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stopTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const fillText = (text: string) => {
    const recognized = text.trim();
    if (!recognized) {
      message.warning('没有识别到文字，请手动输入或换一份媒体。');
      return;
    }
    const combined = [currentText.trim(), recognized].filter(Boolean).join('\n');
    if (combined.length > 1000) {
      message.error('填入后会超过 1000 字限制，请先缩短现有内容或重新识别。');
      return;
    }
    onText(combined);
    message.success('识别结果已填入，可修改后再保存。');
  };

  const runImage = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('请选择 JPEG、PNG 或 WebP 图片。');
      if (imageInput.current) imageInput.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('图片不能超过 10 MB。');
      if (imageInput.current) imageInput.current.value = '';
      return;
    }
    setBusy(true);
    try {
      fillText(await recognizeImage(file));
    } catch (error) {
      message.error(extractErrorMessage(error, '图片识别失败，可继续手动录入。'));
    } finally {
      setBusy(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  };

  const uploadRecording = async (blob: Blob) => {
    if (!blob.size) {
      message.warning('录音为空，请重新录制。');
      return;
    }
    if (blob.size > 10 * 1024 * 1024) {
      message.error('录音超过 10 MB，请缩短后重试。');
      return;
    }
    setBusy(true);
    try {
      fillText(await transcribeAudio(blob));
    } catch (error) {
      message.error(extractErrorMessage(error, '语音转写失败，可继续手动录入。'));
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = () => {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = undefined;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      message.error('当前浏览器不支持录音，请使用 HTTPS 或选择支持录音的浏览器。');
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        void uploadRecording(recordingBlob);
      };
      activeRecorder.start();
      setRecording(true);
      stopTimer.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      message.error('无法访问麦克风，请检查浏览器权限或继续手动录入。');
    }
  };

  return (
    <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
      <Space wrap>
        <input
          ref={imageInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          hidden
          onChange={(event) => void runImage(event.target.files?.[0])}
        />
        <Button
          size="small"
          icon={<CameraOutlined />}
          disabled={disabled || busy || recording}
          loading={busy}
          onClick={() => imageInput.current?.click()}
        >
          拍照或选图识别
        </Button>
        {recording ? (
          <Button size="small" danger icon={<StopOutlined />} onClick={stopRecording}>
            停止并转写
          </Button>
        ) : (
          <Button
            size="small"
            icon={<AudioOutlined />}
            disabled={disabled || busy}
            loading={busy}
            onClick={() => void startRecording()}
          >
            录音转文字
          </Button>
        )}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        媒体最长 60 秒、最大 10 MB，仅发送到管理员配置的本机识别服务；结果可编辑，不会自动保存。
      </Typography.Text>
    </Space>
  );
}
