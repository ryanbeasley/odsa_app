import { ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useEvents } from '../hooks/useEvents';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { useWorkingGroups } from '../hooks/useWorkingGroups';
import { useAuth } from '../hooks/useAuth';

type EventFocus =
  | { type: 'event'; value: number }
  | { type: 'series'; value: string }
  | null;

type AppDataContextValue = {
  announcements: ReturnType<typeof useAnnouncements>;
  events: ReturnType<typeof useEvents>;
  groups: ReturnType<typeof useWorkingGroups>;
  push: ReturnType<typeof usePushSubscription>;
  eventFilters: {
    attendingOnly: boolean;
    setAttendingOnly: (value: boolean) => void;
    focus: EventFocus;
    setFocus: (next: EventFocus) => void;
    clearFocus: () => void;
  };
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const announcements = useAnnouncements(token);
  const events = useEvents(token);
  const groups = useWorkingGroups(token);
  const push = usePushSubscription(token);
  const [attendingOnly, setAttendingOnly] = useState(true);
  const [focus, setFocus] = useState<EventFocus>(null);

  const value = useMemo<AppDataContextValue>(
    () => ({
      announcements,
      events,
      groups,
      push,
      eventFilters: {
        attendingOnly,
        setAttendingOnly,
        focus,
        setFocus,
        clearFocus: () => setFocus(null),
      },
    }),
    [announcements, events, groups, push, attendingOnly, focus]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
