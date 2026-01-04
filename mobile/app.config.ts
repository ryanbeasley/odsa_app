import type { ExpoConfig } from '@expo/config-types';
import type { ConfigContext } from 'expo/config';
import appJson from './app.json';

const rawConfig = (appJson as unknown) as { expo?: ExpoConfig } & ExpoConfig;
const baseConfig: ExpoConfig = rawConfig.expo ?? (rawConfig as ExpoConfig);

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    config.extra?.eas?.projectId ??
    baseConfig.extra?.eas?.projectId;

  const notification = {
    ...(baseConfig as { notification?: Record<string, unknown> }).notification,
    vapidPublicKey:
      process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ??
      (baseConfig as { notification?: { vapidPublicKey?: string } }).notification?.vapidPublicKey,
    serviceWorkerPath:
      process.env.EXPO_PUBLIC_NOTIFICATION_SW_PATH ??
      (baseConfig as { notification?: { serviceWorkerPath?: string } }).notification?.serviceWorkerPath ??
      'expo-service-worker.js',
  } as ExpoConfig['notification'] & { vapidPublicKey?: string; serviceWorkerPath?: string };

  return {
    ...baseConfig,
    ...config,
    name: config.name ?? baseConfig.name ?? 'ODSA Mobile',
    slug: config.slug ?? baseConfig.slug ?? 'odsa-mobile',
    notification,
    plugins: Array.from(
      new Set([...(baseConfig.plugins ?? []), ...(config.plugins ?? []), 'expo-router'])
    ),
    extra: {
      ...baseConfig.extra,
      ...config.extra,
      eas: {
        ...baseConfig.extra?.eas,
        ...config.extra?.eas,
        projectId,
      },
      applicationId:
        process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID ??
        config.android?.package ??
        baseConfig.android?.package,
    },
  };
};
