import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { colors } from '../styles/theme';
import { Announcement } from '../types';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { styles } from './AnnouncementsScreen.styles';
import { useAppData } from '../providers/AppDataProvider';
import { useAuth } from '../hooks/useAuth';

/**
 * Renders the announcement feed plus the admin compose surface and link modal.
 */
export function AnnouncementsScreen() {
  const router = useRouter();
  const { announcements: announcementsState } = useAppData();
  const { isViewingAsAdmin } = useAuth();
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const hasMore = announcementsState.hasMore;
  const canSave = useMemo(
    () => Boolean(isViewingAsAdmin && announcementsState.draft.trim() && !announcementsState.saving),
    [announcementsState.draft, announcementsState.saving, isViewingAsAdmin]
  );

  const triggerLoadMore = useCallback(() => {
    if (!hasMore || isFetchingMore) {
      return;
    }
    setIsFetchingMore(true);
    announcementsState.loadMoreAnnouncements();
  }, [announcementsState, hasMore, isFetchingMore]);

  useEffect(() => {
    if (!announcementsState.loadingMore) {
      setIsFetchingMore(false);
    }
  }, [announcementsState.loadingMore]);

  useEffect(() => {
    if (
      hasMore &&
      !announcementsState.loading &&
      !announcementsState.loadingMore &&
      !isFetchingMore &&
      layoutHeight > 0 &&
      contentHeight > 0 &&
      contentHeight <= layoutHeight + 24
    ) {
      triggerLoadMore();
    }
  }, [
    announcementsState.loading,
    announcementsState.loadingMore,
    contentHeight,
    hasMore,
    isFetchingMore,
    layoutHeight,
    triggerLoadMore,
  ]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < 120) {
      triggerLoadMore();
    }
  };

  /**
   * Persists the current draft via the announcements hook.
   */
  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    try {
      await announcementsState.saveAnnouncement();
    } catch {
      // handled downstream
    }
  };

  /**
   * Opens the link composer modal with a blank state.
   */
  const handleOpenLinkModal = () => {
    setLinkLabel('');
    setLinkUrl('');
    setLinkError(null);
    setLinkModalVisible(true);
  };

  /**
   * Closes the link composer modal and clears its state.
   */
  const handleCloseLinkModal = () => {
    setLinkModalVisible(false);
    setLinkLabel('');
    setLinkUrl('');
    setLinkError(null);
  };

  /**
   * Validates the provided label+URL and injects Markdown syntax into the draft.
   */
  const handleInsertLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) {
      setLinkError('Add both link text and a URL.');
      return;
    }
    const urlValue = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    try {
      new URL(urlValue);
    } catch {
      setLinkError('Enter a valid URL.');
      return;
    }
    const encodedUrl = encodeURI(urlValue);
    const markup = `[${linkLabel.trim()}](${encodedUrl})`;
    announcementsState.setDraft(
      announcementsState.draft ? `${announcementsState.draft.trimEnd()} ${markup}` : markup
    );
    handleCloseLinkModal();
  };

  /**
   * Routes internal deep links in-app and opens external ones via Linking.
   */
  const handleMessageLinkPress = (url: string) => {
    if (tryOpenInternalLink(url)) {
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', `Try again or copy this address:\n${url}`);
    });
  };

  /**
   * Attempts to interpret the URL as an Expo Router route for in-app navigation.
   */
  const tryOpenInternalLink = (url: string) => {
    try {
      const parsed = Linking.parse(url);
      const path = normalizePath(parsed.path ?? undefined);
      if (path.startsWith('/tabs/events')) {
        const search = buildSearch(parsed.queryParams ?? undefined);
        router.push(`${path}${search}`);
        return true;
      }
    } catch {
      // ignore and fall back to external handling
    }
    return false;
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
          {isViewingAsAdmin ? (
            <>
              <Text style={styles.info}>Post short updates about meetings, canvasses, or wins.</Text>
              <TouchableOpacity style={styles.linkButton} onPress={handleOpenLinkModal} activeOpacity={0.85}>
                <Feather name="link-2" size={16} color={colors.primary} />
                <Text style={styles.linkButtonLabel}>Add link</Text>
              </TouchableOpacity>
              <TextField
                style={styles.input}
                value={announcementsState.draft}
                onChangeText={(value) => {
                  announcementsState.setError(null);
                  announcementsState.setDraft(value);
                }}
                editable={!announcementsState.saving}
                placeholder="Type a quick announcement..."
                multiline
              />
              {announcementsState.error ? <Text style={styles.error}>{announcementsState.error}</Text> : null}
              <PrimaryButton
                label="Save announcement"
                loading={announcementsState.saving}
                disabled={!canSave}
                onPress={handleSave}
              />
            </>
          ) : (
            <Text style={styles.info}>End of announcements.</Text>
          )}
          {announcementsState.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : announcementsState.announcements.length ? (
            <>
              <View style={styles.announcementBody}>
                {announcementsState.announcements.map((announcement) => (
                  <View key={announcement.id} style={styles.announcementItem}>
                    <Text style={styles.timestamp}>{formatTimestamp(announcement.createdAt)}</Text>
                    {renderAnnouncementMessage(announcement.body, handleMessageLinkPress)}
                  </View>
                ))}
              </View>
              {announcementsState.loadingMore ? (
                <ActivityIndicator style={styles.loadingMoreIndicator} color={colors.primaryDark} />
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyState}>No announcements yet. Check back soon.</Text>
          )}
        </SectionCard>
      </ScrollView>
      <Modal
        visible={linkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseLinkModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add hyperlink</Text>
            <Text style={styles.modalDescription}>Enter the label and URL you want to insert.</Text>
            <TextField label="Link text" value={linkLabel} onChangeText={setLinkLabel} placeholder="Link label" />
            <TextField label="URL" value={linkUrl} onChangeText={setLinkUrl} placeholder="https://example.org" />
            {linkError ? <Text style={styles.error}>{linkError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.linkActionButton, styles.cancelButton]} onPress={handleCloseLinkModal}>
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkActionButton} onPress={handleInsertLink}>
                <Text style={styles.linkActionLabel}>Insert link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Converts an ISO string into friendly day/time display.
 */
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

/**
 * Breaks a message into text/link segments and renders tappable inline links.
 */
function renderAnnouncementMessage(message: string, onLinkPress: (url: string) => void) {
  const segments = parseLinkSegments(message);
  return (
    <Text style={styles.message}>
      {segments.map((segment, index) =>
        segment.url ? (
          <Text
            key={`link-${index}`}
            style={styles.linkText}
            onPress={() => onLinkPress(segment.url!)}
            suppressHighlighting
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </Text>
  );
}

/**
 * Parses `[text](url)` Markdown syntax into a list of text/link segments.
 */
function parseLinkSegments(message: string): { text: string; url?: string }[] {
  const regex = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const segments: { text: string; url?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: message.slice(lastIndex, match.index) });
    }
    segments.push({ text: match[1], url: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < message.length) {
    segments.push({ text: message.slice(lastIndex) });
  }
  return segments.length ? segments : [{ text: message }];
}

/**
 * Normalizes parsed paths so `//tabs/events` becomes `/tabs/events`.
 */
function normalizePath(value?: string | null) {
  if (!value) {
    return '/';
  }
  // Linking.parse can return paths like //tabs/events; strip duplicate slashes
  const stripped = value.replace(/^\/+/, '/');
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/**
 * Serializes parsed query params back into a query string.
 */
function buildSearch(queryParams?: Record<string, string | string[] | null | undefined> | null) {
  if (!queryParams) {
    return '';
  }
  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      params.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          params.append(key, entry);
        }
      });
    }
  });
  const result = params.toString();
  return result ? `?${result}` : '';
}
