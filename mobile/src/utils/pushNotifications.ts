import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export async function registerForPushNotifications() {
  if (Platform.OS === 'web') {
    throw new Error('Expo push tokens are not available on web builds. Use browser push with VAPID keys instead.');
  }

  if (Constants.appOwnership === 'expo') {
    throw new Error('Push notifications are unavailable in Expo Go. Please build a development client to test.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    throw new Error('Notifications permission not granted');
  }

  const projectId =
    (Constants as { expoConfig?: { extra?: { eas?: { projectId?: string } }; projectId?: string } }).expoConfig?.extra
      ?.eas?.projectId ??
    (Constants as { expoConfig?: { projectId?: string } }).expoConfig?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return tokenResponse.data;
}
