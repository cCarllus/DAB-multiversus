import { resolveApiErrorMessage } from '@frontend/services/api/api-error';
import type {
  SocialDirectoryPresenceFilter,
  SocialUserSummary,
} from '@frontend/services/social/social-types';
import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';
import type { SocialStore } from '@frontend/stores/social.store';

import socialScreenTemplate from './social-screen.html?raw';
import { createSocialHoverCard } from './social-hover-card';
import {
  createSocialUserList,
  type SocialBoardItem,
} from './social-user-list';
import './social-screen.css';

interface SocialScreenOptions {
  i18n: AppI18n;
  onOpenProfile: (nickname: string) => void;
  socialStore: SocialStore;
}

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

type SocialSection = 'friends' | 'pending' | 'players';

export function createSocialScreen(options: SocialScreenOptions): HTMLElement {
  const rootElement = createElementFromTemplate(socialScreenTemplate);
  const feedbackElement = rootElement.querySelector<HTMLElement>('[data-social-feedback]');
  const subnav = rootElement.querySelector<HTMLElement>('[data-social-subnav]');
  const directory = rootElement.querySelector<HTMLElement>('[data-social-directory]');

  if (!feedbackElement || !subnav || !directory) {
    throw new Error('Social screen could not be initialized.');
  }

  const sectionButtons = Array.from(
    subnav.querySelectorAll<HTMLButtonElement>('[data-social-section]'),
  );
  let isBusy = false;
  let feedback: FeedbackState | null = null;
  let searchTimer: number | null = null;
  let activeSection: SocialSection = 'players';
  let currentPresenceFilter: SocialDirectoryPresenceFilter = 'all';
  let currentQuery = '';

  const hoverCard = createSocialHoverCard({
    i18n: options.i18n,
    onPrimaryAction: (user) => {
      void handlePrimaryAction({
        user,
      });
    },
    onViewProfile: (nickname) => {
      options.onOpenProfile(nickname);
    },
  });

  const userList = createSocialUserList({
    i18n: options.i18n,
    onHoverLeave: () => {
      hoverCard.scheduleHide();
    },
    onHoverUser: (user, anchor) => {
      hoverCard.show(user, anchor, isBusy);
    },
    onLoadMore: () => {
      void handleLoadMore();
    },
    onPresenceChange: (value) => {
      currentPresenceFilter = value;
      void handleSearch();
    },
    onSearchChange: (value) => {
      if (searchTimer !== null) {
        window.clearTimeout(searchTimer);
      }

      searchTimer = window.setTimeout(() => {
        currentQuery = value;
        void handleSearch();
      }, 220);
    },
    onSelectUser: (nickname) => {
      options.onOpenProfile(nickname);
    },
    onUserAction: (item) => {
      void handlePrimaryAction(item);
    },
  });

  directory.append(userList.element);
  rootElement.append(hoverCard.element);

  sectionButtons.forEach((button) => {
    const section = button.dataset.socialSection as SocialSection | undefined;

    if (!section) {
      return;
    }

    button.textContent = options.i18n.t(`menu.social.sections.${section}`);
    button.addEventListener('click', () => {
      void applySection(section);
    });
  });

  const setFeedback = (nextFeedback: FeedbackState | null): void => {
    feedback = nextFeedback;

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

  const render = (): void => {
    const snapshot = options.socialStore.getSnapshot();

    if (!snapshot) {
      return;
    }

    rootElement.dataset.section = activeSection;
    sectionButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.socialSection === activeSection);
    });

    const boardItems = resolveBoardItems(snapshot);
    userList.setState({
      activeSection,
      hasMore: activeSection === 'players' ? snapshot.directory.hasMore : false,
      isBusy,
      items: boardItems,
      presence: currentPresenceFilter,
      query: currentQuery,
      selectedNickname: snapshot.profile?.nickname ?? null,
      total: boardItems.length,
    });
  };

  const matchesFilters = (user: SocialUserSummary): boolean => {
    const normalizedQuery = currentQuery.trim().toLowerCase();

    if (
      normalizedQuery &&
      !user.nickname.toLowerCase().includes(normalizedQuery) &&
      !user.name.toLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }

    if (currentPresenceFilter === 'online' && user.presence.status === 'offline') {
      return false;
    }

    if (currentPresenceFilter === 'offline' && user.presence.status !== 'offline') {
      return false;
    }

    return true;
  };

  const resolveBoardItems = (snapshot: NonNullable<ReturnType<SocialStore['getSnapshot']>>): SocialBoardItem[] => {
    if (activeSection === 'friends') {
      return snapshot.friends.friends
        .filter(matchesFilters)
        .map((user) => ({
          user,
        }));
    }

    if (activeSection === 'pending') {
      return [
        ...snapshot.incomingRequests.requests.map((request) => ({
          createdAt: request.createdAt,
          requestDirection: 'incoming' as const,
          requestId: request.id,
          user: request.user,
        })),
        ...snapshot.outgoingRequests.requests.map((request) => ({
          createdAt: request.createdAt,
          requestDirection: 'outgoing' as const,
          requestId: request.id,
          user: request.user,
        })),
      ].filter((item) => matchesFilters(item.user));
    }

    return snapshot.directory.users
      .filter(matchesFilters)
      .map((user) => ({
        user,
      }));
  };

  const handleMutation = async (
    operation: () => Promise<unknown>,
    feedbackKey: 'accepted' | 'cancelled' | 'rejected' | 'requestSent',
  ): Promise<void> => {
    isBusy = true;
    render();

    try {
      await operation();
      setFeedback({
        message: options.i18n.t(`menu.social.feedback.${feedbackKey}`),
        tone: 'success',
      });
      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    } finally {
      isBusy = false;
      render();
    }
  };

  const handlePrimaryAction = async (item: SocialBoardItem): Promise<void> => {
    const { user } = item;

    if (item.requestDirection === 'outgoing' && item.requestId) {
      await handleMutation(
        async () => options.socialStore.cancelOutgoingRequest(item.requestId!),
        'cancelled',
      );
      return;
    }

    if (user.relationship.state === 'friends') {
      options.onOpenProfile(user.nickname);
      return;
    }

    if (user.relationship.state === 'pending_received' && user.relationship.requestId) {
      await handleMutation(
        async () => options.socialStore.acceptFriendRequest(user.relationship.requestId!),
        'accepted',
      );
      return;
    }

    await handleMutation(async () => options.socialStore.sendFriendRequest(user.nickname), 'requestSent');
  };

  const handleSearch = async (
  ): Promise<void> => {
    isBusy = true;
    render();

    try {
      if (activeSection === 'players') {
        await options.socialStore.searchDirectory({
          presence: currentPresenceFilter,
          q: currentQuery,
          relationship: 'all',
        });
      } else {
        await options.socialStore.load(false);
      }
      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    } finally {
      isBusy = false;
      render();
    }
  };

  const applySection = async (section: SocialSection): Promise<void> => {
    activeSection = section;
    await handleSearch();
  };

  const handleLoadMore = async (): Promise<void> => {
    isBusy = true;
    render();

    try {
      await options.socialStore.loadMoreDirectory();
      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    } finally {
      isBusy = false;
      render();
    }
  };

  const cachedSnapshot = options.socialStore.getSnapshot();

  if (cachedSnapshot) {
    render();
  }

  const unsubscribe = options.socialStore.subscribe(() => {
    if (!rootElement.isConnected) {
      unsubscribe();
      return;
    }

    render();
  });

  void options.socialStore
    .load(!cachedSnapshot)
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
