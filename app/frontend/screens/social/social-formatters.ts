import type { AppI18n } from '@shared/i18n';
import type { SocialUserSummary } from '@frontend/services/social/social-types';
import type { SocialBoardSection } from './social-user-list';

const ACCENT_COLORS = ['#64baff', '#6fe0a0', '#ff9d5c', '#e7c268', '#d278ff', '#5fe5d0'];
const MATCH_ACTIVITY_MARKERS = [
  'arena',
  'casual',
  'duel',
  'jogando',
  'match',
  'partida',
  'playing',
  'ranked',
  'skirmish',
];

export interface SocialActionDescriptor {
  action: 'accept' | 'add' | 'friends' | 'pending' | 'reject' | 'remove' | 'view';
  disabled: boolean;
  label: string;
}

function resolvePrimaryMonogram(user: SocialUserSummary): string {
  const source = user.name.trim() || user.nickname.trim() || '?';
  return source[0]?.toUpperCase() ?? '?';
}

export function createSocialAvatar(user: SocialUserSummary): string {
  if (user.profileImageUrl) {
    return user.profileImageUrl;
  }

  const monogram = resolvePrimaryMonogram(user);
  const accent = resolveAccentColor(user.nickname);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#10161f" />
          <stop offset="100%" stop-color="#05080d" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="18" fill="url(#bg)" />
      <rect x="10" y="10" width="76" height="76" rx="14" fill="${accent}" fill-opacity="0.14" />
      <text x="50%" y="58%" text-anchor="middle" fill="#f3ead7" font-size="38" font-family="Georgia, serif">${monogram}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveAccentColor(seed: string): string {
  const hash = [...seed].reduce((value, character) => value + character.charCodeAt(0), 0);
  return ACCENT_COLORS[hash % ACCENT_COLORS.length] ?? ACCENT_COLORS[0];
}

export function formatMemberSince(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatShortDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function resolvePresenceLabel(
  status: SocialUserSummary['presence']['status'],
  i18n: AppI18n,
): string {
  switch (status) {
    case 'in_launcher':
      return i18n.t('menu.social.presence.inLauncher');
    case 'online':
      return i18n.t('menu.social.presence.online');
    default:
      return i18n.t('menu.social.presence.offline');
  }
}

export function isSocialMatchActivity(activity: string | null | undefined): boolean {
  const normalizedActivity = activity?.trim().toLowerCase();

  if (!normalizedActivity) {
    return false;
  }

  return MATCH_ACTIVITY_MARKERS.some((marker) => normalizedActivity.includes(marker));
}

export function resolvePresenceStatusLabel(user: SocialUserSummary, i18n: AppI18n): string {
  if (user.presence.status !== 'offline' && isSocialMatchActivity(user.presence.currentActivity)) {
    return i18n.t('menu.social.presence.inMatch');
  }

  return resolvePresenceLabel(user.presence.status, i18n);
}

export function resolveActivityLabel(user: SocialUserSummary, i18n: AppI18n): string {
  return user.presence.currentActivity?.trim() || resolvePresenceStatusLabel(user, i18n);
}

export function resolveUserLevel(user: SocialUserSummary): number {
  return user.level;
}

export function resolvePresenceTone(
  value: SocialUserSummary | SocialUserSummary['presence']['status'],
): string {
  if (typeof value !== 'string') {
    if (value.presence.status === 'offline') {
      return 'is-offline';
    }

    if (isSocialMatchActivity(value.presence.currentActivity)) {
      return 'is-match';
    }

    if (value.presence.status === 'in_launcher') {
      return 'is-launcher';
    }

    return 'is-online';
  }

  const status = value;

  if (status === 'offline') {
    return 'is-offline';
  }

  if (status === 'in_launcher') {
    return 'is-launcher';
  }

  return 'is-online';
}

export function resolveQuickAction(
  user: SocialUserSummary,
  i18n: AppI18n,
  section: SocialBoardSection = 'players',
): SocialActionDescriptor {
  if (section === 'players') {
    return {
      action: 'view',
      disabled: false,
      label: i18n.t('menu.social.actions.viewProfile'),
    };
  }

  switch (user.relationship.state) {
    case 'pending_received':
      return {
        action: 'accept',
        disabled: false,
        label: i18n.t('menu.social.actions.accept'),
      };
    case 'pending_sent':
      return {
        action: section === 'pending' ? 'reject' : 'pending',
        disabled: section !== 'pending',
        label:
          section === 'pending'
            ? i18n.t('menu.social.actions.cancel')
            : i18n.t('menu.social.actions.requestSent'),
      };
    case 'friends':
      return {
        action: 'remove',
        disabled: false,
        label: i18n.t('menu.social.actions.removeFriend'),
      };
    default:
      return {
        action: 'add',
        disabled: false,
        label: i18n.t('menu.social.actions.addFriend'),
      };
  }
}

export function resolveProfileAction(
  user: SocialUserSummary,
  i18n: AppI18n,
): SocialActionDescriptor {
  switch (user.relationship.state) {
    case 'pending_received':
      return {
        action: 'accept',
        disabled: false,
        label: i18n.t('menu.social.actions.accept'),
      };
    case 'pending_sent':
      return {
        action: 'pending',
        disabled: true,
        label: i18n.t('menu.social.actions.requestSent'),
      };
    case 'friends':
      return {
        action: 'remove',
        disabled: false,
        label: i18n.t('menu.social.actions.removeFriend'),
      };
    default:
      return {
        action: 'add',
        disabled: false,
        label: i18n.t('menu.social.actions.addFriend'),
      };
  }
}
