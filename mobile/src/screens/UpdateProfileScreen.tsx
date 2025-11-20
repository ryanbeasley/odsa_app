import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors, radii, spacing } from '../styles/theme';
import { User } from '../types';

type UpdateProfileScreenProps = {
  user: User;
  onSubmit: (values: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string;
  }) => Promise<void>;
  onCancel: () => void;
};

export function UpdateProfileScreen({ user, onSubmit, onCancel }: UpdateProfileScreenProps) {
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phone ?? '');
    setEmail(user.email);
  }, [user]);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        firstName: firstName.trim() ? firstName.trim() : null,
        lastName: lastName.trim() ? lastName.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionCard style={styles.section}>
          <Text style={styles.heading}>Update your information</Text>
          <Text style={styles.description}>
            Share contact details so organizers can reach you about events or volunteer opportunities. All fields are optional.
          </Text>
          <TextField label="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" />
          <TextField label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" />
          <TextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
          />
          <TextField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SecondaryButton label="Cancel" onPress={onCancel} style={styles.actionButton} />
            <PrimaryButton label="Save" onPress={handleSubmit} loading={saving} style={styles.actionButton} />
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  error: {
    color: colors.error,
  },
});
