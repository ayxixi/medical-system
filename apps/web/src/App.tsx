import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './routes/RequireAuth';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const HomePage = lazy(() => import('./pages/home/HomePage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const VisitsPage = lazy(() => import('./pages/visits/VisitsPage'));
const VisitDetailPage = lazy(() => import('./pages/visits/VisitDetailPage'));
const HealthLogsPage = lazy(() => import('./pages/health-logs/HealthLogsPage'));
const AiPage = lazy(() => import('./pages/ai/AiPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const VisitSummaryPage = lazy(() => import('./pages/visit-summary/VisitSummaryPage'));
const DataExportPage = lazy(() => import('./pages/data-export/DataExportPage'));
const AuditPage = lazy(() => import('./pages/audit/AuditPage'));
const AppLayout = lazy(() => import('./layouts/AppLayout'));

export default function App() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" style={{ padding: 24, textAlign: 'center' }}>
          页面加载中…
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/visits" element={<VisitsPage />} />
          <Route path="/visits/:id" element={<VisitDetailPage />} />
          <Route path="/health-logs" element={<HealthLogsPage />} />
          <Route path="/visit-summary" element={<VisitSummaryPage />} />
          <Route path="/data-export" element={<DataExportPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
