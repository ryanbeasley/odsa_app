import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing } from '../styles/theme';
import { Announcement, User } from '../types';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';

type AnnouncementsScreenProps = {
  user: User;
  announcements: Announcement[];
  draft: string;
  loading: boolean;
  saving: boolean;
  loadingMore: boolean;
  error: string | null;
  isAdmin: boolean;
  canSave: boolean;
  hasMore: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onLoadMore: () => void;
};

export function AnnouncementsScreen({
  user,
  announcements,
  draft,
  loading,
  saving,
  loadingMore,
  error,
  isAdmin,
  canSave,
  onDraftChange,
  onSave,
  hasMore,
  onLoadMore,
}: AnnouncementsScreenProps) {
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const triggerLoadMore = useCallback(() => {
    if (!hasMore || isFetchingMore) {
      return;
    }
    setIsFetchingMore(true);
    onLoadMore();
  }, [hasMore, isFetchingMore, onLoadMore]);

  useEffect(() => {
    if (!loadingMore) {
      setIsFetchingMore(false);
    }
  }, [loadingMore]);

  useEffect(() => {
    if (
      hasMore &&
      !loading &&
      !loadingMore &&
      !isFetchingMore &&
      layoutHeight > 0 &&
      contentHeight > 0 &&
      contentHeight <= layoutHeight + 24
    ) {
      triggerLoadMore();
    }
  }, [contentHeight, hasMore, isFetchingMore, layoutHeight, loading, loadingMore, triggerLoadMore]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < 120) {
      triggerLoadMore();
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={(event) => {
          setLayoutHeight(event.nativeEvent.layout.height);
        }}
        onContentSizeChange={(_w, h) => {
          setContentHeight(h);
        }}
      >
        <SectionCard style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Announcements</Text>
          {isAdmin ? (
            <>
              <Text style={styles.info}>Post short updates about meetings, canvasses, or wins.</Text>
              <TextField
                style={styles.input}
                value={draft}
                onChangeText={onDraftChange}
                editable={!saving}
                placeholder="Type a quick announcement..."
                multiline
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Save announcement" loading={saving} disabled={!canSave} onPress={onSave} />
            </>
          ) : (
            <Text style={styles.info}>End of announcements.</Text>
          )}
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : announcements.length ? (
            <>
              <View style={styles.announcementBody}>
                {announcements.map((announcement) => (
                  <View key={announcement.id} style={styles.announcementItem}>
                    <Text style={styles.timestamp}>{formatTimestamp(announcement.createdAt)}</Text>
                    <Text style={styles.message}>{announcement.body}</Text>
                  </View>
                ))}
              </View>
              {loadingMore ? (
                <ActivityIndicator style={styles.loadingMoreIndicator} color={colors.primaryDark} />
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyState}>No announcements yet. Check back soon.</Text>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
  sectionCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  announcementBody: {
    gap: spacing.xs,
  },
  announcementItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  info: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  loadingMoreIndicator: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
});
