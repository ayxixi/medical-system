import { cleanup, render, screen } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { useAuthStore } from './store/auth';

function renderAt(path: string) {
  return render(
    <AntdApp>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    </AntdApp>,
  );
}

describe('App routes', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.getState().clear();
  });

  it('loads the login route on demand', async () => {
    renderAt('/login');

    expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument();
  });

  it('keeps protected routes redirecting unauthenticated users to login', async () => {
    renderAt('/visits');

    expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument();
  });
});
