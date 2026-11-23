import type { ReactNode } from 'react';
import { MedicineBoxFilled } from '@ant-design/icons';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-story">
          <div className="auth-brand">
            <span className="auth-brand-mark"><MedicineBoxFilled /></span>
            <span>安心记录 · 清晰管理</span>
          </div>
          <div className="auth-story-copy">
            <div className="page-eyebrow">医疗记录系统</div>
            <h1>让每一次就诊，<br />都有迹可循。</h1>
            <p>把家庭成员的就诊、诊断、用药和附件收纳在一个清晰、私密的空间里。</p>
          </div>
          <div className="auth-story-note">为自己和家人，留下一份安心的健康记录。</div>
        </section>
        <section className="auth-panel">
          <ThemeToggle className="auth-theme-toggle" />
          <div className="auth-card">
            <div className="page-eyebrow">欢迎使用</div>
            <h2>{title}</h2>
            <p className="auth-description">{description}</p>
            {children}
            {footer && <div className="auth-footer">{footer}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
