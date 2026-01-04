import { Slot, usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Hero } from '../../src/components/Hero';
import { BottomNav, TabKey } from '../../src/components/BottomNav';
import { AppDataProvider, useAppData } from '../../src/providers/AppDataProvider';
import { TAB_ROUTES, tabFromPathname } from '../../src/navigation/tabs';

/**
 * Wraps the tabs stack in the shared app data provider and renders the shell.
 */
export default function TabsLayout() {
  return (
    <AppDataProvider>
      <TabsShell />
    </AppDataProvider>
  );
}

/**
 * Hosts the hero, outlet, and bottom navigation while syncing tab state.
 */
function TabsShell() {
  const pathname = usePathname();
  const router = useRouter();
  const { eventFilters } = useAppData();
  const activeTab = useMemo<TabKey>(() => tabFromPathname(pathname ?? ''), [pathname]);

  /**
   * Navigates between tabs and resets certain filters when necessary.
   */
  const handleSelectTab = (tab: TabKey) => {
    if (tab === 'events') {
      eventFilters.setAttendingOnly(true);
      eventFilters.clearFocus();
    }
    const target = TAB_ROUTES[tab];
    if (target) {
      router.push(target);
    }
  };

  return (
    <View style={styles.loggedIn}>
      <View style={styles.loggedInContent}>
        <Hero eyebrow="Orlando DSA" title="Organize for a better Orlando" />
        <View style={styles.tabContent}>
          <Slot />
        </View>
      </View>
      <View style={styles.bottomNavWrapper}>
        <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loggedIn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  loggedInContent: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  tabContent: {
    flex: 1,
    width: '100%',
  },
  bottomNavWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
