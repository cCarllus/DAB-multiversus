import {
  resolveAuthDisplayName,
  type AuthSessionSnapshot,
  type AuthUser,
} from '@app/auth/auth-types';
import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import profileTemplate from './profile.html?raw';
import './profile.css';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface ProfilePageOptions {
  i18n: AppI18n;
  session: AuthSessionSnapshot;
  user: AuthUser;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDate(
  value: string | null | undefined,
  locale: string,
  fallback: string,
): string {
  const parsedDate = parseDate(value);

  if (!parsedDate) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function formatDateTime(
  value: string | null | undefined,
  locale: string,
  fallback: string,
): string {
  const parsedDate = parseDate(value);

  if (!parsedDate) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function getElapsedDays(value: string, now = Date.now()): number {
  const parsedDate = parseDate(value);

  if (!parsedDate) {
    return 0;
  }

  return Math.max(1, Math.ceil((now - parsedDate.getTime()) / ONE_DAY_MS));
}

function getRemainingUnits(
  value: string | null | undefined,
  unitMs: number,
  now = Date.now(),
): number {
  const parsedDate = parseDate(value);

  if (!parsedDate) {
    return 0;
  }

  return Math.max(0, Math.ceil((parsedDate.getTime() - now) / unitMs));
}

function getInitials(label: string): string {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'DA';
  }

  return parts
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function getShortId(id: string): string {
  return id.replaceAll('-', '').slice(0, 10).toUpperCase();
}

export function createProfilePage(options: ProfilePageOptions): HTMLElement {
  const { i18n, session, user } = options;
  const locale = i18n.getLocale();
  const messages = i18n.getMessages();
  const displayName = resolveAuthDisplayName(user);
  const playerMonogram = getInitials(displayName);
  const accountAgeDays = getElapsedDays(user.createdAt);
  const tenureMonths = Math.max(1, Math.ceil(accountAgeDays / 30));
  const sessionHoursRemaining = getRemainingUnits(session.sessionExpiresAt, ONE_HOUR_MS);
  const rememberedDaysRemaining = session.rememberDevice
    ? getRemainingUnits(session.sessionExpiresAt, ONE_DAY_MS)
    : 0;
  const localeLabel = messages.login.locale.options[locale].label;
  const shortId = getShortId(user.id);
  const fallbackValue = messages.menu.profile.fallbackValue;
  const usernameValue = user.username ?? messages.menu.profile.fallbackUsername;
  const heroTagline = user.username
    ? messages.menu.profile.taglineClaimed
    : messages.menu.profile.taglineFallback;
  const accessModeLabel = session.rememberDevice
    ? messages.menu.profile.accessModes.remembered
    : messages.menu.profile.accessModes.sessionOnly;
  const rememberedMarkerValue = session.rememberDevice
    ? `${i18n.formatNumber(Math.max(1, rememberedDaysRemaining))}D`
    : messages.menu.profile.markerValues.sessionOnly;
  const localeMarkerValue =
    locale === 'pt-BR'
      ? messages.menu.profile.markerValues.pt
      : messages.menu.profile.markerValues.en;
  const usernameMarkerValue = user.username
    ? messages.menu.profile.markerValues.set
    : messages.menu.profile.markerValues.auto;
  const sessionExpiryValue = formatDateTime(
    session.sessionExpiresAt,
    locale,
    fallbackValue,
  );
  const accessExpiryValue = formatDateTime(
    session.accessTokenExpiresAt,
    locale,
    fallbackValue,
  );
  const createdAtValue = formatDate(user.createdAt, locale, fallbackValue);

  return createElementFromTemplate(profileTemplate, {
    ACCESS_EXPIRY_LABEL: escapeHtml(messages.menu.profile.dossier.accessExpires),
    ACCESS_EXPIRY_META: escapeHtml(messages.menu.profile.dossier.accessExpiresMeta),
    ACCESS_EXPIRY_VALUE: escapeHtml(accessExpiryValue),
    ACCESS_MODE_LABEL: escapeHtml(accessModeLabel),
    ACCOUNT_AGE_DAYS_LABEL: escapeHtml(messages.menu.profile.stats.accountAgeDays.label),
    ACCOUNT_AGE_DAYS_TIER: escapeHtml(messages.menu.profile.stats.accountAgeDays.eyebrow),
    ACCOUNT_AGE_DAYS_VALUE: escapeHtml(i18n.formatNumber(accountAgeDays)),
    ACCOUNT_ID_LABEL: escapeHtml(messages.menu.profile.dossier.accountId),
    ACCOUNT_ID_META: escapeHtml(
      i18n.t('menu.profile.dossier.accountIdMeta', {
        id: user.id,
      }),
    ),
    ACCOUNT_ID_VALUE: escapeHtml(shortId),
    DOSSIER_EYEBROW: escapeHtml(messages.menu.profile.dossierEyebrow),
    DOSSIER_TITLE: escapeHtml(messages.menu.profile.dossierTitle),
    LOCALE_LABEL: escapeHtml(localeLabel),
    MARKER_AUTH_META: escapeHtml(messages.menu.profile.markers.authenticated.meta),
    MARKER_AUTH_TITLE: escapeHtml(messages.menu.profile.markers.authenticated.title),
    MARKER_AUTH_VALUE: escapeHtml(messages.menu.profile.markerValues.live),
    MARKER_DEVICE_META: escapeHtml(
      session.rememberDevice
        ? messages.menu.profile.markers.device.metaRemembered
        : messages.menu.profile.markers.device.metaSession,
    ),
    MARKER_DEVICE_TITLE: escapeHtml(messages.menu.profile.markers.device.title),
    MARKER_DEVICE_VALUE: escapeHtml(rememberedMarkerValue),
    MARKER_LOCALE_META: escapeHtml(messages.menu.profile.markers.locale.meta),
    MARKER_LOCALE_TITLE: escapeHtml(messages.menu.profile.markers.locale.title),
    MARKER_LOCALE_VALUE: escapeHtml(localeMarkerValue),
    MARKER_USERNAME_META: escapeHtml(
      user.username
        ? messages.menu.profile.markers.username.metaClaimed
        : messages.menu.profile.markers.username.metaFallback,
    ),
    MARKER_USERNAME_TITLE: escapeHtml(messages.menu.profile.markers.username.title),
    MARKER_USERNAME_VALUE: escapeHtml(usernameMarkerValue),
    MARKERS_EYEBROW: escapeHtml(messages.menu.profile.markersEyebrow),
    MARKERS_TITLE: escapeHtml(messages.menu.profile.markersTitle),
    MEMBER_SINCE: escapeHtml(createdAtValue),
    OVERVIEW_SUMMARY: escapeHtml(messages.menu.profile.overviewSummary),
    OVERVIEW_TITLE: escapeHtml(messages.menu.profile.overviewTitle),
    PLAYER_ALIAS: escapeHtml(displayName),
    PLAYER_EMAIL: escapeHtml(user.email),
    PLAYER_ID_LABEL: escapeHtml(messages.menu.profile.profileIdLabel),
    PLAYER_ID_SHORT: escapeHtml(shortId),
    PLAYER_MONOGRAM: escapeHtml(playerMonogram),
    PRIMARY_ACTION: escapeHtml(messages.menu.profile.primaryAction),
    PROFILE_EYEBROW: escapeHtml(messages.menu.profile.eyebrow),
    PROFILE_HERO_ARIA_LABEL: escapeHtml(messages.menu.profile.heroAriaLabel),
    PROFILE_OVERVIEW_ARIA_LABEL: escapeHtml(messages.menu.profile.overviewAriaLabel),
    PROFILE_SUMMARY: escapeHtml(messages.menu.profile.summary),
    PROFILE_TAGLINE: escapeHtml(heroTagline),
    SESSION_EXPIRY_LABEL: escapeHtml(messages.menu.profile.dossier.sessionExpires),
    SESSION_EXPIRY_META: escapeHtml(messages.menu.profile.dossier.sessionExpiresMeta),
    SESSION_EXPIRY_VALUE: escapeHtml(sessionExpiryValue),
    SESSION_HOURS_LABEL: escapeHtml(messages.menu.profile.stats.sessionHours.label),
    SESSION_HOURS_TIER: escapeHtml(messages.menu.profile.stats.sessionHours.eyebrow),
    SESSION_HOURS_VALUE: escapeHtml(i18n.formatNumber(sessionHoursRemaining)),
    STATS_EYEBROW: escapeHtml(messages.menu.profile.statsEyebrow),
    STATS_TITLE: escapeHtml(messages.menu.profile.statsTitle),
    TAG_ACCESS_LABEL: escapeHtml(messages.menu.profile.tagLabels.access),
    TAG_EMAIL_LABEL: escapeHtml(messages.menu.profile.tagLabels.email),
    TAG_MEMBER_LABEL: escapeHtml(messages.menu.profile.tagLabels.memberSince),
    TENURE_BADGE_LABEL: escapeHtml(messages.menu.profile.stats.tenureMonths.badge),
    TENURE_MONTHS_LABEL: escapeHtml(messages.menu.profile.stats.tenureMonths.label),
    TENURE_MONTHS_TIER: escapeHtml(messages.menu.profile.stats.tenureMonths.eyebrow),
    TENURE_MONTHS_VALUE: escapeHtml(i18n.formatNumber(tenureMonths)),
    USERNAME_LABEL: escapeHtml(messages.menu.profile.dossier.username),
    USERNAME_META: escapeHtml(
      user.username
        ? messages.menu.profile.dossier.usernameMetaClaimed
        : messages.menu.profile.dossier.usernameMetaFallback,
    ),
    USERNAME_VALUE: escapeHtml(usernameValue),
    USER_CREATED_AT_LABEL: escapeHtml(messages.menu.profile.dossier.createdAt),
    USER_CREATED_AT_META: escapeHtml(messages.menu.profile.dossier.createdAtMeta),
    USER_CREATED_AT_VALUE: escapeHtml(createdAtValue),
    USER_EMAIL_LABEL: escapeHtml(messages.menu.profile.dossier.email),
    USER_EMAIL_META: escapeHtml(messages.menu.profile.dossier.emailMeta),
    USER_EMAIL_VALUE: escapeHtml(user.email),
  });
}
