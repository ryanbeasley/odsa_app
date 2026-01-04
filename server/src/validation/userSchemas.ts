import type { AuthedRequest } from '../middleware/authenticate';
import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export type ProfileUpdates = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  event_alerts_sms_enabled?: number;
  username?: string;
};

export type ProfileUpdateResult = { updates: ProfileUpdates } | { error: string; status: number };

export const profileUpdateSchema: Schema<ProfileUpdates> = {
  parse(input: unknown, req?: unknown) {
    const result = buildProfileUpdates(input);
    if ('error' in result) {
      throw new ValidationError(result.error, result.status);
    }
    return result.updates;
  },
};

function readOptionalString(value: unknown) {
  if (value === undefined) {
    return { value: undefined };
  }
  if (value !== null && typeof value !== 'string') {
    return null;
  }
  const trimmed = typeof value === 'string' ? value.trim() : null;
  return { value: trimmed };
}

function normalizeUsername(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!usernamePattern.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizePhoneToE164(value: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\+\d{8,15}$/.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return null;
}

/**
 * Validates and normalizes user profile updates.
 */
function buildProfileUpdates(
  body: unknown
): ProfileUpdateResult {
  const { firstName, lastName, phone, email, eventAlertsSmsEnabled, username } = (body ?? {}) as Record<
    string,
    unknown
  >;
  const updates: ProfileUpdates = {};

  const assignOptionalField = (
    label: string,
    input: unknown,
    apply: (value: string | null) => void
  ): ProfileUpdateResult | null => {
    const parsed = readOptionalString(input);
    if (parsed === null) {
      return { error: `${label} must be a string`, status: 400 };
    }
    if (parsed.value !== undefined) {
      apply(parsed.value);
    }
    return null;
  };

  const firstError = assignOptionalField('First name', firstName, (value) => {
    updates.first_name = value;
  });
  if (firstError) {
    return firstError;
  }

  const lastError = assignOptionalField('Last name', lastName, (value) => {
    updates.last_name = value;
  });
  if (lastError) {
    return lastError;
  }

  const parsedPhone = readOptionalString(phone);
  if (parsedPhone === null) {
    return { error: 'Phone must be a string', status: 400 };
  }
  if (parsedPhone.value !== undefined) {
    const normalized = normalizePhoneToE164(parsedPhone.value);
    if (parsedPhone.value && !normalized) {
      return { error: 'Phone must be a valid E.164 number (e.g. +14075551234)', status: 400 };
    }
    updates.phone = normalized;
  }

  if (username !== undefined) {
    if (typeof username !== 'string') {
      return { error: 'Username must be a string', status: 400 };
    }
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return { error: 'Username must be 3-32 characters (letters, numbers, . _ -)', status: 400 };
    }
    updates.username = normalizedUsername;
  }

  if (email === undefined) {
    if (eventAlertsSmsEnabled === undefined) {
      return { updates };
    }
  }

  if (eventAlertsSmsEnabled !== undefined) {
    if (typeof eventAlertsSmsEnabled !== 'boolean') {
      return { error: 'SMS event alerts must be true or false', status: 400 };
    }
    updates.event_alerts_sms_enabled = eventAlertsSmsEnabled ? 1 : 0;
  }

  if (email !== null && typeof email !== 'string') {
    return { error: 'Email must be a string', status: 400 };
  }
  if (email === null) {
    updates.email = null;
    return { updates };
  }
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: 'Email is invalid', status: 400 };
  }
  if (normalizedEmail) {
    updates.email = normalizedEmail;
  }

  return { updates };
}
