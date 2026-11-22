import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './routes/RequireAuth';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const HomePage = lazy(() => import('./pages/home/HomePage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const VisitsPage = lazy(() => import('./pages/visits/VisitsPage'));
const VisitDetailPage = lazy(() => import('./pages/visits/VisitDetailPage'));
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
