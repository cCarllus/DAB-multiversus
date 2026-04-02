import { resolveApiErrorMessage } from '@frontend/services/api/api-error';
import type { AuthSessionSnapshot } from '@frontend/services/auth/auth-types';
import type { AuthUser } from '@frontend/services/auth/auth-types';
import type { ProfileFeedback, ProfileSnapshot } from '@frontend/services/profile/profile.types';
import { createElementFromTemplate } from '@frontend/lib/html';
import {
  createSocialAvatar,
  resolveActivityLabel,
  resolvePresenceLabel,
  resolvePresenceTone,
  resolveProfileAction,
} from '@frontend/screens/social/social-formatters';
import type { SocialUserSummary } from '@frontend/services/social/social-types';
import type { AppI18n } from '@shared/i18n';
import type { ProfileStore } from '@frontend/stores/profile.store';
import type { SocialStore } from '@frontend/stores/social.store';

import '@frontend/components/modal-chrome.css';

import profileScreenTemplate from './profile-screen.html?raw';
import { createProfileAvatarUploader } from './profile-avatar-uploader';
import { createProfileHeader } from './profile-header';
import { createProfileNameEditor } from './profile-name-editor';
import './profile-screen.css';

interface ProfileScreenOptions {
  currentUser: AuthUser;
  i18n: AppI18n;
  profileStore: ProfileStore;
  profileTargetNickname?: string | null;
  session: AuthSessionSnapshot;
  socialStore: SocialStore;
}

const publicProfileTemplate = `
  <section class="profile-hero profile-hero--public">
    <div class="profile-public-hero__avatar-slot">
      <img class="profile-public-hero__avatar" data-public-avatar />
    </div>

    <div class="profile-hero__copy">
      <p class="profile-hero__eyebrow" data-public-eyebrow></p>
      <h1 class="profile-public-hero__nickname" data-public-nickname></h1>
      <p class="profile-public-hero__name" data-public-name></p>
      <span class="profile-public-hero__status" data-public-status></span>
      <p class="profile-public-hero__summary" data-public-summary></p>

      <div class="profile-hero__meta">
        <span class="profile-hero__meta-pill">
          <span class="profile-hero__meta-label" data-public-member-label></span>
          <strong class="profile-hero__meta-value" data-public-member-value></strong>
        </span>

        <span class="profile-hero__meta-pill">
          <span class="profile-hero__meta-label" data-public-activity-label></span>
          <strong class="profile-hero__meta-value" data-public-activity-value></strong>
        </span>

        <span class="profile-hero__meta-pill">
          <span class="profile-hero__meta-label" data-public-relationship-label></span>
          <strong class="profile-hero__meta-value" data-public-relationship-value></strong>
        </span>
      </div>

      <div class="profile-public-hero__actions">
        <button type="button" class="profile-public-hero__action" data-public-action></button>
      </div>
    </div>
  </section>

  <section class="profile-panel profile-panel--public">
    <div class="profile-public-panel">
      <p class="profile-panel__eyebrow" data-public-section-eyebrow></p>
      <h2 class="profile-public-panel__title" data-public-section-title></h2>
      <p class="profile-public-panel__summary" data-public-section-summary></p>
    </div>
  </section>
`;

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function createFeedbackSetter(feedbackElement: HTMLElement) {
  return (feedback: ProfileFeedback | null): void => {
    if (!feedback) {
      feedbackElement.hidden = true;
      feedbackElement.textContent = '';
      feedbackElement.dataset.tone = '';
      return;
    }

    feedbackElement.hidden = false;
    feedbackElement.textContent = feedback.message;
    feedbackElement.dataset.tone = feedback.tone;
  };
}

function createCurrentProfileScreen(
  options: ProfileScreenOptions,
  rootElement: HTMLElement,
  content: HTMLElement,
  setFeedback: (feedback: ProfileFeedback | null) => void,
): HTMLElement {
  const messages = options.i18n.getMessages().menu.profile;

  const avatarUploader = createProfileAvatarUploader({
    i18n: options.i18n,
    onConfirm: async (file) => {
      avatarUploader.setBusy(true);
      setFeedback(null);

      try {
        const snapshot = await options.profileStore.uploadAvatar(file);
        applySnapshot(snapshot);
        setFeedback({
          message: messages.feedback.photoUpdated,
          tone: 'success',
        });
      } catch (error) {
        setFeedback({
          message: resolveApiErrorMessage(error, options.i18n),
          tone: 'error',
        });
        throw error;
      } finally {
        avatarUploader.setBusy(false);
      }
    },
    onInvalid: (message) => {
      setFeedback({
        message,
        tone: 'error',
      });
    },
  });
  const nameEditor = createProfileNameEditor({
    i18n: options.i18n,
    onInvalid: (message) => {
      setFeedback({
        message,
        tone: 'error',
      });
    },
    onSave: async (name) => {
      nameEditor.setBusy(true);
      setFeedback(null);

      try {
        const snapshot = await options.profileStore.updateName(name);
        applySnapshot(snapshot);
        setFeedback({
          message: messages.feedback.nameUpdated,
          tone: 'success',
        });
      } catch (error) {
        setFeedback({
          message: resolveApiErrorMessage(error, options.i18n),
          tone: 'error',
        });
        throw error;
      } finally {
        nameEditor.setBusy(false);
      }
    },
  });
  const header = createProfileHeader({
    avatarUploader,
    i18n: options.i18n,
    nameEditor,
  });

  content.append(header.element, avatarUploader.modal);

  const applySnapshot = (snapshot: ProfileSnapshot): void => {
    const locale = options.i18n.getLocale();
    const languageLabel = options.i18n.getMessages().login.locale.options[locale].label;
    const memberSince = formatDate(snapshot.profile.createdAt, locale);
    const launcherStatus = messages.status.launcherReady;
    const trustedDeviceStatus = options.session.rememberDevice
      ? messages.status.trustedDeviceSaved
      : messages.status.sessionOnly;

    header.setState({
      accountStatus: launcherStatus,
      languageLabel,
      memberSince,
      profile: snapshot.profile,
      trustedDevice: trustedDeviceStatus,
      userId: `@${snapshot.profile.nickname}`,
    });
  };

  const cachedSnapshot = options.profileStore.getSnapshot();

  if (cachedSnapshot) {
    applySnapshot(cachedSnapshot);
  }

  void options.profileStore
    .load(!cachedSnapshot)
    .then((snapshot) => {
      applySnapshot(snapshot);
    })
    .catch((error) => {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
    });

  return rootElement;
}

function createPublicProfileScreen(
  options: ProfileScreenOptions,
  rootElement: HTMLElement,
  content: HTMLElement,
  setFeedback: (feedback: ProfileFeedback | null) => void,
  targetNickname: string,
): HTMLElement {
  const publicProfile = createElementFromTemplate(publicProfileTemplate);
  const avatar = publicProfile.querySelector<HTMLImageElement>('[data-public-avatar]');
  const nickname = publicProfile.querySelector<HTMLElement>('[data-public-nickname]');
  const name = publicProfile.querySelector<HTMLElement>('[data-public-name]');
  const status = publicProfile.querySelector<HTMLElement>('[data-public-status]');
  const summary = publicProfile.querySelector<HTMLElement>('[data-public-summary]');
  const memberLabel = publicProfile.querySelector<HTMLElement>('[data-public-member-label]');
  const memberValue = publicProfile.querySelector<HTMLElement>('[data-public-member-value]');
  const activityLabel = publicProfile.querySelector<HTMLElement>('[data-public-activity-label]');
  const activityValue = publicProfile.querySelector<HTMLElement>('[data-public-activity-value]');
  const relationshipLabel = publicProfile.querySelector<HTMLElement>('[data-public-relationship-label]');
  const relationshipValue = publicProfile.querySelector<HTMLElement>('[data-public-relationship-value]');
  const actionButton = publicProfile.querySelector<HTMLButtonElement>('[data-public-action]');
  const sectionEyebrow = publicProfile.querySelector<HTMLElement>('[data-public-section-eyebrow]');
  const sectionTitle = publicProfile.querySelector<HTMLElement>('[data-public-section-title]');
  const sectionSummary = publicProfile.querySelector<HTMLElement>('[data-public-section-summary]');
  const eyebrow = publicProfile.querySelector<HTMLElement>('[data-public-eyebrow]');

  if (
    !avatar ||
    !nickname ||
    !name ||
    !status ||
    !summary ||
    !memberLabel ||
    !memberValue ||
    !activityLabel ||
    !activityValue ||
    !relationshipLabel ||
    !relationshipValue ||
    !actionButton ||
    !sectionEyebrow ||
    !sectionTitle ||
    !sectionSummary ||
    !eyebrow
  ) {
    throw new Error('Public profile screen could not be initialized.');
  }

  content.append(publicProfile);

  memberLabel.textContent = options.i18n.t('menu.social.profile.memberSince');
  activityLabel.textContent = options.i18n.t('menu.social.profile.currentActivity');
  relationshipLabel.textContent = options.i18n.t('menu.social.directory.relationshipFilter');
  sectionEyebrow.textContent = options.i18n.t('menu.social.profile.sectionEyebrow');
  sectionTitle.textContent = options.i18n.t('menu.social.profile.sectionTitle');
  sectionSummary.textContent = options.i18n.t('menu.social.profile.sectionSummary');
  eyebrow.textContent = options.i18n.t('menu.social.profile.eyebrow');

  let activeProfile: SocialUserSummary | null = null;
  let isBusy = false;

  const resolveRelationshipLabel = (profile: SocialUserSummary): string => {
    switch (profile.relationship.state) {
      case 'friends':
        return options.i18n.t('menu.social.actions.friends');
      case 'pending_sent':
        return options.i18n.t('menu.social.actions.requestSent');
      case 'pending_received':
        return options.i18n.t('menu.social.actions.accept');
      default:
        return options.i18n.t('menu.social.actions.addFriend');
    }
  };

  const render = (): void => {
    const snapshot = options.socialStore.getSnapshot();
    const snapshotProfile =
      snapshot?.profile?.nickname === targetNickname ? snapshot.profile : activeProfile;

    if (!snapshotProfile) {
      nickname.textContent = `@${targetNickname}`;
      name.textContent = options.i18n.t('menu.social.profile.loading');
      summary.textContent = options.i18n.t('menu.social.profile.loading');
      status.textContent = options.i18n.t('menu.social.profile.loading');
      memberValue.textContent = '...';
      activityValue.textContent = '...';
      relationshipValue.textContent = '...';
      actionButton.disabled = true;
      actionButton.textContent = options.i18n.t('menu.social.profile.loading');
      return;
    }

    activeProfile = snapshotProfile;
    const action = resolveProfileAction(snapshotProfile, options.i18n);
    avatar.src = createSocialAvatar(snapshotProfile);
    avatar.alt = snapshotProfile.nickname;
    nickname.textContent = `@${snapshotProfile.nickname}`;
    name.textContent = snapshotProfile.name;
    status.className = `profile-public-hero__status ${resolvePresenceTone(
      snapshotProfile.presence.status,
    )}`;
    status.textContent = resolvePresenceLabel(snapshotProfile.presence.status, options.i18n);
    summary.textContent = resolveActivityLabel(snapshotProfile, options.i18n);
    memberValue.textContent = formatDate(snapshotProfile.createdAt, options.i18n.getLocale());
    activityValue.textContent = resolveActivityLabel(snapshotProfile, options.i18n);
    relationshipValue.textContent = resolveRelationshipLabel(snapshotProfile);
    actionButton.disabled = isBusy || action.disabled;
    actionButton.dataset.variant = action.action;
    actionButton.textContent = action.label;
  };

  const runAction = async (): Promise<void> => {
    if (!activeProfile) {
      return;
    }

    const requestId = activeProfile.relationship.requestId;

    if (activeProfile.relationship.state === 'pending_sent' || activeProfile.relationship.state === 'friends') {
      return;
    }

    isBusy = true;
    setFeedback(null);
    render();

    try {
      if (activeProfile.relationship.state === 'pending_received' && requestId) {
        await options.socialStore.acceptFriendRequest(requestId);
      } else {
        await options.socialStore.sendFriendRequest(activeProfile.nickname);
      }

      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
    } finally {
      isBusy = false;
      render();
    }
  };

  actionButton.addEventListener('click', () => {
    void runAction();
  });

  const unsubscribe = options.socialStore.subscribe(() => {
    if (!rootElement.isConnected) {
      unsubscribe();
      return;
    }

    render();
  });

  render();

  void options.socialStore
    .selectProfile(targetNickname)
    .then(() => {
      render();
    })
    .catch((error) => {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
    });

  return rootElement;
}

export function createProfileScreen(options: ProfileScreenOptions): HTMLElement {
  const rootElement = createElementFromTemplate(profileScreenTemplate);
  const content = rootElement.querySelector<HTMLElement>('[data-profile-content]');
  const feedbackElement = rootElement.querySelector<HTMLElement>('[data-profile-feedback]');

  if (!content || !feedbackElement) {
    throw new Error('Profile screen could not be initialized.');
  }

  const setFeedback = createFeedbackSetter(feedbackElement);
  const targetNickname = options.profileTargetNickname?.trim().toLowerCase() ?? null;
  const currentNickname = options.currentUser.nickname.trim().toLowerCase();

  if (!targetNickname || targetNickname === currentNickname) {
    return createCurrentProfileScreen(options, rootElement, content, setFeedback);
  }

  return createPublicProfileScreen(options, rootElement, content, setFeedback, targetNickname);
}
