import { TabKey } from '../components/BottomNav';

export const TAB_ROUTES: Record<TabKey, string> = {
  home: '/tabs',
  announcements: '/tabs/announcements',
  events: '/tabs/events',
  settings: '/tabs/settings',
  support: '/tabs/support',
  workingGroups: '/tabs/working-groups',
};

/**
 * Routes paths within the app to a specific TabKey
 */
export function tabFromPathname(pathname: string): TabKey {
  if (pathname.startsWith('/tabs/announcements')) {
    return 'announcements';
  }
  if (pathname.startsWith('/tabs/events')) {
    return 'events';
  }
  if (pathname.startsWith('/tabs/support')) {
    return 'support';
  }
  if (pathname.startsWith('/tabs/working-groups')) {
    return 'workingGroups';
  }
  if (pathname.startsWith('/tabs/settings')) {
    return 'settings';
  }
  return 'home';
}
