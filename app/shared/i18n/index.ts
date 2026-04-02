import { STORAGE_KEYS } from '@shared/constants/storage-keys';

import enMessages from './locales/en.json';
import ptBrMessages from './locales/pt-BR.json';

export const SUPPORTED_LOCALES = ['pt-BR', 'en'] as const;
const DEFAULT_LOCALE: AppLocale = 'pt-BR';

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationMessages = typeof enMessages;

type InterpolationValue = number | string;
type InterpolationValues = Record<string, InterpolationValue>;
interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface BrowserGlobals {
  localStorage?: StorageLike;
  navigator?: {
    language?: string;
  };
}

interface LocaleOptionCopy {
  description: string;
  label: string;
}

export interface AppI18n {
  formatNumber: (value: number) => string;
  getLocale: () => AppLocale;
  getMessages: () => TranslationMessages;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, values?: InterpolationValues) => string;
}

const MESSAGES_BY_LOCALE: Record<AppLocale, TranslationMessages> = {
  'pt-BR': ptBrMessages as TranslationMessages,
  en: enMessages as TranslationMessages,
};

function interpolateMessage(
  template: string,
  values: InterpolationValues = {},
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(values[key] ?? ''),
  );
}

function resolveMessageValue(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((currentValue, segment) => {
    if (!currentValue || typeof currentValue !== 'object') {
      return undefined;
    }

    return (currentValue as Record<string, unknown>)[segment];
  }, source);
}

function readStoredLocale(): AppLocale | null {
  const browserGlobals = globalThis as BrowserGlobals;
  const storage = browserGlobals.localStorage;

  if (!storage) {
    return null;
  }

  try {
    const storedLocale = storage.getItem(STORAGE_KEYS.locale);
    return isSupportedLocale(storedLocale) ? storedLocale : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: AppLocale): void {
  const browserGlobals = globalThis as BrowserGlobals;
  const storage = browserGlobals.localStorage;

  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEYS.locale, locale);
  } catch {
    // Swallow storage failures so locale changes never break rendering.
  }
}

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'pt-BR';
}

export function resolveAppLocale(candidate: string | null | undefined): AppLocale {
  const normalizedCandidate = candidate?.trim().toLowerCase();

  if (!normalizedCandidate) {
    return DEFAULT_LOCALE;
  }

  if (normalizedCandidate === 'pt-br' || normalizedCandidate.startsWith('pt')) {
    return 'pt-BR';
  }

  if (normalizedCandidate === 'en' || normalizedCandidate.startsWith('en')) {
    return 'en';
  }

  return DEFAULT_LOCALE;
}

export function getInitialLocale(): AppLocale {
  const storedLocale = readStoredLocale();

  if (storedLocale) {
    return storedLocale;
  }

  const browserGlobals = globalThis as BrowserGlobals;

  if (browserGlobals.navigator?.language) {
    return resolveAppLocale(browserGlobals.navigator.language);
  }

  return DEFAULT_LOCALE;
}

export function getLocaleOptionCopy(
  messages: TranslationMessages,
  locale: AppLocale,
): LocaleOptionCopy {
  return messages.login.locale.options[locale];
}

export function createI18n(initialLocale: AppLocale = getInitialLocale()): AppI18n {
  let currentLocale = resolveAppLocale(initialLocale);

  return {
    formatNumber(value) {
      return new Intl.NumberFormat(currentLocale).format(value);
    },

    getLocale() {
      return currentLocale;
    },

    getMessages() {
      return MESSAGES_BY_LOCALE[currentLocale];
    },

    setLocale(locale) {
      currentLocale = locale;
      persistLocale(locale);
    },

    t(key, values) {
      const localizedValue = resolveMessageValue(MESSAGES_BY_LOCALE[currentLocale], key);
      const fallbackValue = resolveMessageValue(MESSAGES_BY_LOCALE.en, key);
      const resolvedValue =
        typeof localizedValue === 'string'
          ? localizedValue
          : typeof fallbackValue === 'string'
            ? fallbackValue
            : key;

      return interpolateMessage(resolvedValue, values);
    },
  };
}
