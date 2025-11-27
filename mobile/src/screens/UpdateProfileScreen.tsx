import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { styles } from './UpdateProfileScreen.styles';
import { useAuth } from '../hooks/useAuth';

/**
 * Screen allowing members to update their profile/contact information.
 */
export function UpdateProfileScreen() {
  const auth = useAuth();
  const router = useRouter();
  const user = (auth.sessionUser ?? auth.user)!;
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

  /**
   * Sends the updated profile to the server and navigates back on success.
   */
  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      await auth.updateProfile({
        firstName: firstName.trim() ? firstName.trim() : null,
        lastName: lastName.trim() ? lastName.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim(),
      });
      router.back();
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
            <SecondaryButton label="Cancel" onPress={() => router.back()} style={styles.actionButton} />
            <PrimaryButton label="Save" onPress={handleSubmit} loading={saving} style={styles.actionButton} />
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}
