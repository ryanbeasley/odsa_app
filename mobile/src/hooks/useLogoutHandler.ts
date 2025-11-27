import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppData } from '../providers/AppDataProvider';

export function useLogoutHandler() {
  const auth = useAuth();
  const { push } = useAppData();

  return useCallback(async () => {
    if (auth.token) {
      try {
        await push.disable();
      } catch {
        // ignore best-effort
      }
    }
    auth.logout();
  }, [auth, push]);
}
