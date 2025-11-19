import { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../styles/theme';

export type TabKey = 'home' | 'announcements' | 'events' | 'settings' | 'support' | 'workingGroups';

type BottomNavProps = {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
};

type NavItem = {
  key: TabKey;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
};

const NAV_ITEMS: NavItem[] = [
  { key: 'events', label: 'Events', icon: 'flag' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === activeTab;
        const isHome = item.key === 'home';
        const iconSize = isHome ? 26 : 20;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.navItem}
            activeOpacity={0.85}
            onPress={() => onSelectTab(item.key)}
          >
            <Feather name={item.icon} size={iconSize} color={isActive ? colors.primary : colors.textMuted} />
            <Text
              style={[
                styles.navLabel,
                isActive && styles.navLabelActive,
                isHome && styles.navLabelHome,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  navLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  navLabelHome: {
    fontSize: 13,
  },
  navLabelActive: {
    color: colors.primary,
  },
});
