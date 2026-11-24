import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/auth';

export function useAiPermissions() {
  const account = useAuthStore((state) => state.account?.id);
  return useQuery({
    queryKey: ['ai-permissions', account],
    enabled: Boolean(account),
    queryFn: async () => (await apiClient.get<{ canManage: boolean }>('/ai/models/permissions')).data,
  });
}
