import type { AppI18n } from '@shared/i18n';

export type AppApiErrorCode =
  | 'ALREADY_FRIENDS'
  | 'ACCESS_TOKEN_EXPIRED'
  | 'AVATAR_REQUIRED'
  | 'AVATAR_TOO_LARGE'
  | 'BACKEND_UNAVAILABLE'
  | 'DATABASE_UNAVAILABLE'
  | 'FRIENDSHIP_BLOCKED'
  | 'FRIENDSHIP_NOT_FOUND'
  | 'FRIENDSHIP_NOT_OWNED'
  | 'FRIEND_REQUEST_ALREADY_RECEIVED'
  | 'FRIEND_REQUEST_ALREADY_SENT'
  | 'FRIEND_REQUEST_NOT_FOUND'
  | 'FRIEND_REQUEST_NOT_OWNED'
  | 'EMAIL_ALREADY_IN_USE'
  | 'INVALID_AVATAR_TYPE'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_NAME'
  | 'LOGOUT_TARGET_REQUIRED'
  | 'NICKNAME_ALREADY_IN_USE'
  | 'REFRESH_TOKEN_INVALID'
  | 'REMEMBER_DEVICE_UNAVAILABLE'
  | 'REQUEST_INVALID'
  | 'SELF_FRIEND_REQUEST'
  | 'SESSION_EXPIRED'
  | 'SESSION_PERSISTENCE_FAILED'
  | 'SESSION_REVOKED'
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'USER_NOT_FOUND'
  | (string & {});

export class AppApiError extends Error {
  constructor(
    public readonly code: AppApiErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AppApiError';
  }
}

export function resolveApiErrorMessage(error: unknown, i18n: AppI18n): string {
  if (error instanceof AppApiError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return i18n.t('auth.errors.invalidCredentials');
      case 'BACKEND_UNAVAILABLE':
      case 'DATABASE_UNAVAILABLE':
        return i18n.t('auth.errors.backendUnavailable');
      case 'SESSION_EXPIRED':
      case 'SESSION_REVOKED':
      case 'REFRESH_TOKEN_INVALID':
      case 'ACCESS_TOKEN_EXPIRED':
      case 'UNAUTHORIZED':
        return i18n.t('auth.errors.sessionExpired');
      case 'REMEMBER_DEVICE_UNAVAILABLE':
        return i18n.t('auth.errors.rememberDeviceUnavailable');
      case 'SESSION_PERSISTENCE_FAILED':
        return i18n.t('auth.errors.sessionPersistenceFailed');
      case 'REQUEST_INVALID':
        return i18n.t('auth.errors.requestInvalid');
      case 'INVALID_NAME':
        return i18n.t('menu.profile.feedback.invalidName');
      case 'INVALID_AVATAR_TYPE':
        return i18n.t('menu.profile.feedback.invalidAvatarType');
      case 'AVATAR_TOO_LARGE':
        return i18n.t('menu.profile.feedback.avatarTooLarge');
      case 'ALREADY_FRIENDS':
        return i18n.t('menu.social.errors.alreadyFriends');
      case 'FRIEND_REQUEST_ALREADY_SENT':
        return i18n.t('menu.social.errors.requestAlreadySent');
      case 'FRIEND_REQUEST_ALREADY_RECEIVED':
        return i18n.t('menu.social.errors.requestAlreadyReceived');
      case 'SELF_FRIEND_REQUEST':
        return i18n.t('menu.social.errors.selfRequest');
      case 'USER_NOT_FOUND':
        return i18n.t('menu.social.errors.userNotFound');
      case 'FRIEND_REQUEST_NOT_FOUND':
      case 'FRIENDSHIP_NOT_FOUND':
        return i18n.t('menu.social.errors.requestNotFound');
      case 'FRIEND_REQUEST_NOT_OWNED':
      case 'FRIENDSHIP_NOT_OWNED':
      case 'FRIENDSHIP_BLOCKED':
        return i18n.t('menu.social.errors.forbiddenAction');
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return i18n.t('auth.errors.default');
}
