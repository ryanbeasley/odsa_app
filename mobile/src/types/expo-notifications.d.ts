declare module 'expo-notifications' {
  type PermissionStatus = 'granted' | 'denied' | 'undetermined';

  export function getPermissionsAsync(): Promise<{ status: PermissionStatus }>;
  export function requestPermissionsAsync(): Promise<{ status: PermissionStatus }>;
  export function getExpoPushTokenAsync(options?: { projectId?: string }): Promise<{ data: string }>;
}
