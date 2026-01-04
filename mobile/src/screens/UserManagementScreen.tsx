import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { colors } from '../styles/theme';
import { SERVER_URL } from '../config';
import { User } from '../types';
import { styles } from './UserManagementScreen.styles';
import { useAuth } from '../hooks/useAuth';

/**
 * Admin-only interface for searching users and toggling their roles.
 */
export function UserManagementScreen() {
  const auth = useAuth();
  const router = useRouter();
  const token = auth.token;
  const currentUserId = auth.sessionUser?.id ?? 0;
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  /**
   * Loads users from the API, optionally filtering by query.
   */
  const fetchUsers = useCallback(
    async (search: string) => {
      if (!token) {
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (search.trim()) {
          params.set('q', search.trim());
        }
        const response = await fetch(`${SERVER_URL}/api/users${params.toString() ? `?${params.toString()}` : ''}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Failed to load users');
        }
        const data = (await response.json()) as { users: User[] };
        setUsers(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setError('You must be signed in to manage users.');
      return;
    }
    const handle = setTimeout(() => {
      fetchUsers(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [fetchUsers, query, token]);

  /**
   * Promotes/demotes a user by toggling their role.
   */
  const handleToggleRole = async (user: User) => {
    if (!token) {
      return;
    }
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    setPendingId(user.id);
    try {
      const response = await fetch(`${SERVER_URL}/api/users/${user.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to update role');
      }
      const data = (await response.json()) as { user: User };
      setUsers((prev) => prev.map((row) => (row.id === data.user.id ? data.user : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionCard style={styles.section}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.85}>
            <Feather name="arrow-left" size={18} color={colors.text} />
            <Text style={styles.backLabel}>Back to settings</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Manage users</Text>
          <Text style={styles.description}>
            Promote trusted members to admin or keep track of who has elevated access. Use the search field to filter by email or name.
          </Text>
          <TextField
            label="Filter by email or name"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            placeholder="Search members..."
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.emailColumn]}>User</Text>
            <Text style={[styles.tableHeaderText, styles.adminColumn]}>Admin?</Text>
          </View>
          <View style={styles.tableBody}>
            {users.length === 0 && !loading ? (
              <Text style={styles.emptyState}>No users match that filter.</Text>
            ) : (
              users.map((entry) => {
                const isSelf = entry.id === currentUserId;
                const isAdmin = entry.role === 'admin';
                return (
                  <View key={entry.id} style={styles.row}>
                    <View style={styles.emailColumn}>
                      <Text style={styles.emailText}>{entry.email}</Text>
                      {entry.firstName || entry.lastName ? (
                        <Text style={styles.nameText}>
                          {[entry.firstName, entry.lastName].filter(Boolean).join(' ')}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      activeOpacity={0.8}
                      onPress={() => handleToggleRole(entry)}
                      disabled={isSelf || pendingId === entry.id}
                    >
                      <Feather
                        name={isAdmin ? 'check-square' : 'square'}
                        size={18}
                        color={isSelf ? colors.textMuted : colors.text}
                      />
                      {isSelf ? <Text style={styles.selfText}>You</Text> : null}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}
