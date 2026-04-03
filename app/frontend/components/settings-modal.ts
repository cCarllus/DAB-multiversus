import { createSvgIcon } from '@frontend/lib/svg-icon';
import type { AppI18n } from '@shared/i18n';

import './modal-chrome.css';
import './settings-modal.css';

export type SettingsCategory = 'video' | 'audio' | 'account';
type SettingsFeedbackTone = 'error' | 'info' | 'success' | 'warning';
type SettingsBusyState = 'delete' | 'email' | 'fullscreen' | 'name' | 'password' | 'resolution';

export interface LauncherDisplayProfile {
  detail: string;
  id: string;
  label: string;
}

export interface LauncherSettingsSnapshot {
  activeCategory: SettingsCategory;
  audio: {
    musicVolume: number;
    soundVolume: number;
  };
  video: {
    fullscreenEnabled: boolean;
    profiles: LauncherDisplayProfile[];
    selectedProfileId: string;
  };
}

export interface SettingsActionResult {
  applied?: boolean;
  message?: string;
  tone?: SettingsFeedbackTone;
}

export interface CreateSettingsModalOptions {
  account: {
    email: string;
    name: string;
    nickname: string;
  };
  i18n: AppI18n;
  onClose: () => void;
  onDeleteAccount: () => Promise<SettingsActionResult | void> | SettingsActionResult | void;
  onMusicVolumeChange: (volume: number) => void;
  onPersistCategory: (category: SettingsCategory) => void;
  onResolutionChange: (
    profileId: string,
  ) => Promise<SettingsActionResult | void> | SettingsActionResult | void;
  onSaveEmail: (email: string) => Promise<SettingsActionResult | void> | SettingsActionResult | void;
  onSaveName: (name: string) => Promise<SettingsActionResult | void> | SettingsActionResult | void;
  onSavePassword: (
    password: string,
  ) => Promise<SettingsActionResult | void> | SettingsActionResult | void;
  onSoundVolumeChange: (volume: number) => void;
  onToggleFullscreen: (
    enabled: boolean,
  ) => Promise<SettingsActionResult | void> | SettingsActionResult | void;
  settings: LauncherSettingsSnapshot;
}

interface SettingsFeedbackState {
  message: string;
  tone: SettingsFeedbackTone;
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  return element;
}

function createIconLabel(iconId: string, label: string): HTMLElement {
  const wrap = createElement('span', 'settings-modal__sidebar-label');
  wrap.append(
    createSvgIcon(iconId, {
      className: 'home-icon home-icon--medium settings-modal__sidebar-icon',
    }),
  );

  const text = createElement('span', 'settings-modal__sidebar-text');
  text.textContent = label;
  wrap.append(text);

  return wrap;
}

function formatVolumeLabel(value: number): string {
  return `${Math.round(clampVolume(value) * 100)}%`;
}

function isApplied(result: SettingsActionResult | void): boolean {
  return result?.applied !== false;
}

function normalizeDisplayName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function updateSliderVisual(input: HTMLInputElement, valueElement: HTMLElement): void {
  const percent = Math.max(0, Math.min(100, Number.parseInt(input.value, 10) || 0));

  input.style.setProperty('--settings-slider-progress', `${percent}%`);
  valueElement.textContent = `${percent}%`;
}

export function createSettingsModal(options: CreateSettingsModalOptions): HTMLElement {
  const messages = options.i18n.getMessages().menu.settings;
  let activeCategory = options.settings.activeCategory;
  let musicVolume = clampVolume(options.settings.audio.musicVolume);
  let soundVolume = clampVolume(options.settings.audio.soundVolume);
  let fullscreenEnabled = options.settings.video.fullscreenEnabled;
  let selectedProfileId = options.settings.video.selectedProfileId;
  let profileOptions = [...options.settings.video.profiles];
  let dropdownOpen = false;
  let deleteConfirmationOpen = false;
  let feedback: SettingsFeedbackState | null = null;
  let committedName = options.account.name.trim();
  let committedEmail = options.account.email.trim();
  let draftName = committedName;
  let draftEmail = committedEmail;
  let draftPassword = '';
  const busyStates: Record<SettingsBusyState, boolean> = {
    delete: false,
    email: false,
    fullscreen: false,
    name: false,
    password: false,
    resolution: false,
  };

  const rootElement = createElement('aside', 'settings-modal');
  rootElement.tabIndex = -1;
  rootElement.setAttribute('aria-label', messages.ariaLabel);
  rootElement.setAttribute('aria-modal', 'true');
  rootElement.setAttribute('role', 'dialog');

  const panel = createElement('div', 'settings-modal__panel');
  const dismissButton = createElement(
    'button',
    'launcher-modal-dismiss settings-modal__dismiss',
  );
  dismissButton.type = 'button';
  dismissButton.setAttribute('aria-label', messages.closeAriaLabel);
  dismissButton.append(createElement('span', 'launcher-modal-dismiss__icon'));
  dismissButton.querySelector<HTMLElement>('.launcher-modal-dismiss__icon')!.textContent = '×';

  const chrome = createElement('div', 'settings-modal__chrome');
  const sidebar = createElement('aside', 'settings-modal__sidebar');
  const sidebarEyebrow = createElement('p', 'settings-modal__eyebrow');
  sidebarEyebrow.textContent = messages.eyebrow;
  const sidebarTitle = createElement('h2', 'settings-modal__sidebar-title');
  sidebarTitle.textContent = messages.title;
  const sidebarSummary = createElement('p', 'settings-modal__sidebar-summary');
  sidebarSummary.textContent = messages.summary;

  const navigation = createElement('nav', 'settings-modal__sidebar-nav');
  navigation.setAttribute('aria-label', messages.ariaLabel);

  const categoryButtons = new Map<SettingsCategory, HTMLButtonElement>();

  const createCategoryButton = (
    category: SettingsCategory,
    iconId: string,
    label: string,
    summary: string,
  ): HTMLButtonElement => {
    const button = createElement('button', 'settings-modal__sidebar-button');
    button.type = 'button';
    button.append(createIconLabel(iconId, label));

    const buttonSummary = createElement('span', 'settings-modal__sidebar-button-summary');
    buttonSummary.textContent = summary;
    button.append(buttonSummary);
    button.addEventListener('click', () => {
      if (activeCategory === category) {
        return;
      }

      activeCategory = category;
      dropdownOpen = false;
      options.onPersistCategory(category);
      syncSidebarState();
      syncHeaderCopy();
      renderActivePanel();
      renderDeleteConfirmation();
    });

    categoryButtons.set(category, button);
    return button;
  };

  navigation.append(
    createCategoryButton(
      'video',
      'icon-aperture',
      messages.categories.video.label,
      messages.categories.video.summary,
    ),
    createCategoryButton(
      'audio',
      'icon-mic',
      messages.categories.audio.label,
      messages.categories.audio.summary,
    ),
    createCategoryButton(
      'account',
      'icon-shield',
      messages.categories.account.label,
      messages.categories.account.summary,
    ),
  );

  const sidebarFooter = createElement('div', 'settings-modal__sidebar-footer');
  const sidebarFooterLabel = createElement('span', 'settings-modal__sidebar-footer-label');
  sidebarFooterLabel.textContent = messages.sidebar.accountLabel;
  const sidebarFooterValue = createElement('strong', 'settings-modal__sidebar-footer-value');
  sidebarFooterValue.textContent = options.account.nickname || options.account.email;
  sidebarFooter.append(sidebarFooterLabel, sidebarFooterValue);

  sidebar.append(sidebarEyebrow, sidebarTitle, sidebarSummary, navigation, sidebarFooter);

  const content = createElement('div', 'settings-modal__content');
  const header = createElement('header', 'settings-modal__header');
  const headerEyebrow = createElement('p', 'settings-modal__header-eyebrow');
  const headerTitle = createElement('h3', 'settings-modal__header-title');
  const headerSummary = createElement('p', 'settings-modal__header-summary');
  const headerStats = createElement('div', 'settings-modal__header-stats');
  const feedbackElement = createElement('div', 'settings-modal__feedback');
  feedbackElement.hidden = true;
  const body = createElement('div', 'settings-modal__body');
  const deleteConfirmation = createElement('div', 'settings-modal__danger-confirmation');

  header.append(headerEyebrow, headerTitle, headerSummary, headerStats);
  content.append(header, feedbackElement, body, deleteConfirmation);
  chrome.append(sidebar, content);
  panel.append(dismissButton, chrome);
  rootElement.append(panel);

  const setFeedback = (nextFeedback: SettingsFeedbackState | null): void => {
    feedback = nextFeedback;

    if (!feedback) {
      feedbackElement.hidden = true;
      feedbackElement.textContent = '';
      feedbackElement.dataset.tone = '';
      return;
    }

    feedbackElement.hidden = false;
    feedbackElement.dataset.tone = feedback.tone;
    feedbackElement.textContent = feedback.message;
  };

  const syncSidebarState = (): void => {
    categoryButtons.forEach((button, category) => {
      const isActive = category === activeCategory;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const syncHeaderCopy = (): void => {
    const categoryMessages = messages[activeCategory];

    headerEyebrow.textContent = categoryMessages.eyebrow;
    headerTitle.textContent = categoryMessages.title;
    headerSummary.textContent = categoryMessages.summary;
  };

  const runAction = async (
    busyKey: SettingsBusyState,
    callback: () => Promise<SettingsActionResult | void> | SettingsActionResult | void,
  ): Promise<SettingsActionResult | void> => {
    busyStates[busyKey] = true;
    renderActivePanel();
    renderDeleteConfirmation();

    try {
      return await callback();
    } finally {
      busyStates[busyKey] = false;
      renderActivePanel();
      renderDeleteConfirmation();
    }
  };

  const handleVideoAction = async (
    busyKey: 'fullscreen' | 'resolution',
    callback: () => Promise<SettingsActionResult | void> | SettingsActionResult | void,
  ): Promise<void> => {
    try {
      const result = await runAction(busyKey, callback);

      if (result?.message) {
        setFeedback({
          message: result.message,
          tone: result.tone ?? 'info',
        });
      }
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : messages.feedback.genericFailure,
        tone: 'error',
      });
    }
  };

  const buildSettingCard = (label: string, description: string): HTMLElement => {
    const card = createElement('article', 'settings-modal__setting-card');
    const copy = createElement('div', 'settings-modal__setting-copy');
    const title = createElement('h4', 'settings-modal__setting-title');
    title.textContent = label;
    const summary = createElement('p', 'settings-modal__setting-summary');
    summary.textContent = description;
    copy.append(title, summary);
    card.append(copy);
    return card;
  };

  const buildVideoPanel = (): HTMLElement => {
    const section = createElement('section', 'settings-modal__panel-section');
    const selectedProfile =
      profileOptions.find((profile) => profile.id === selectedProfileId) ?? profileOptions[0];

    const fullscreenCard = buildSettingCard(
      messages.video.fullscreen.label,
      messages.video.fullscreen.description,
    );
    const fullscreenControl = createElement('div', 'settings-modal__toggle-wrap');
    const fullscreenState = createElement('span', 'settings-modal__toggle-state');
    fullscreenState.dataset.state = fullscreenEnabled ? 'on' : 'off';
    fullscreenState.textContent = fullscreenEnabled
      ? messages.video.fullscreen.enabled
      : messages.video.fullscreen.disabled;

    const fullscreenButton = createElement('button', 'settings-modal__toggle');
    fullscreenButton.type = 'button';
    fullscreenButton.disabled = busyStates.fullscreen;
    fullscreenButton.dataset.state = fullscreenEnabled ? 'on' : 'off';
    fullscreenButton.setAttribute('aria-pressed', String(fullscreenEnabled));
    const fullscreenKnob = createElement('span', 'settings-modal__toggle-knob');
    fullscreenButton.append(fullscreenKnob);
    fullscreenButton.addEventListener('click', () => {
      const nextValue = !fullscreenEnabled;

      void handleVideoAction('fullscreen', async () => {
        const result = await options.onToggleFullscreen(nextValue);

        if (isApplied(result)) {
          fullscreenEnabled = nextValue;
        }

        return (
          result ?? {
            message: nextValue
              ? messages.feedback.fullscreenEnabled
              : messages.feedback.fullscreenDisabled,
            tone: 'info',
          }
        );
      });
    });

    fullscreenControl.append(fullscreenState, fullscreenButton);
    fullscreenCard.append(fullscreenControl);

    const resolutionCard = buildSettingCard(
      messages.video.resolution.label,
      messages.video.resolution.description,
    );
    const resolutionWrap = createElement('div', 'settings-modal__dropdown-wrap');
    resolutionWrap.dataset.settingsResolution = 'true';
    const resolutionButton = createElement('button', 'settings-modal__dropdown-trigger');
    resolutionButton.type = 'button';
    resolutionButton.disabled = busyStates.resolution;
    resolutionButton.dataset.open = String(dropdownOpen);
    const resolutionLabel = createElement('span', 'settings-modal__dropdown-copy');
    const resolutionValue = createElement('strong', 'settings-modal__dropdown-value');
    resolutionValue.textContent = selectedProfile?.label ?? messages.video.resolution.label;
    const resolutionDetail = createElement('span', 'settings-modal__dropdown-detail');
    resolutionDetail.textContent = selectedProfile?.detail ?? '';
    resolutionLabel.append(resolutionValue, resolutionDetail);
    resolutionButton.append(
      resolutionLabel,
      createSvgIcon('icon-chevron-down', {
        className: 'home-icon home-icon--small settings-modal__dropdown-icon',
      }),
    );

    resolutionButton.addEventListener('click', () => {
      dropdownOpen = !dropdownOpen;
      renderActivePanel();
    });

    resolutionWrap.append(resolutionButton);

    if (dropdownOpen) {
      const dropdownMenu = createElement('div', 'settings-modal__dropdown-menu');

      profileOptions.forEach((profile) => {
        const optionButton = createElement('button', 'settings-modal__dropdown-option');
        optionButton.type = 'button';
        optionButton.dataset.selected = String(profile.id === selectedProfileId);
        const optionLabel = createElement('strong', 'settings-modal__dropdown-option-label');
        optionLabel.textContent = profile.label;
        const optionDetail = createElement('span', 'settings-modal__dropdown-option-detail');
        optionDetail.textContent = profile.detail;
        optionButton.append(optionLabel, optionDetail);
        optionButton.addEventListener('click', () => {
          dropdownOpen = false;

          void handleVideoAction('resolution', async () => {
            const result = await options.onResolutionChange(profile.id);

            if (isApplied(result)) {
              selectedProfileId = profile.id;
            }

            return (
              result ?? {
                message: messages.feedback.resolutionUpdated,
                tone: 'success',
              }
            );
          });
        });
        dropdownMenu.append(optionButton);
      });

      resolutionWrap.append(dropdownMenu);
    }

    resolutionCard.append(resolutionWrap);
    section.append(fullscreenCard, resolutionCard);
    return section;
  };

  const buildAudioSlider = (
    label: string,
    description: string,
    value: number,
    onChange: (nextValue: number) => void,
  ): HTMLElement => {
    const card = buildSettingCard(label, description);
    const sliderWrap = createElement('div', 'settings-modal__slider-wrap');
    const valueElement = createElement('strong', 'settings-modal__slider-value');
    valueElement.textContent = formatVolumeLabel(value);

    const input = createElement('input', 'settings-modal__slider');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(Math.round(clampVolume(value) * 100));
    updateSliderVisual(input, valueElement);
    input.addEventListener('input', () => {
      updateSliderVisual(input, valueElement);
      onChange((Number.parseInt(input.value, 10) || 0) / 100);
    });

    sliderWrap.append(valueElement, input);
    card.append(sliderWrap);
    return card;
  };

  const buildAudioPanel = (): HTMLElement => {
    const section = createElement('section', 'settings-modal__panel-section');

    section.append(
      buildAudioSlider(
        messages.audio.musicVolume.label,
        messages.audio.musicVolume.description,
        musicVolume,
        (nextValue) => {
          musicVolume = clampVolume(nextValue);
          options.onMusicVolumeChange(musicVolume);
        },
      ),
      buildAudioSlider(
        messages.audio.sfxVolume.label,
        messages.audio.sfxVolume.description,
        soundVolume,
        (nextValue) => {
          soundVolume = clampVolume(nextValue);
          options.onSoundVolumeChange(soundVolume);
        },
      ),
    );

    return section;
  };

  const buildAccountFormCard = (
    kind: 'email' | 'name' | 'password',
    label: string,
    description: string,
    value: string,
    placeholder: string,
    actionLabel: string,
    busyLabel: string,
    inputType: string,
    isDirty: boolean,
    onInput: (nextValue: string) => void,
    onSubmit: () => Promise<void>,
  ): HTMLElement => {
    const card = buildSettingCard(label, description);
    const form = createElement('form', 'settings-modal__account-form');
    const input = createElement('input', 'settings-modal__text-input');
    input.autocomplete = 'off';
    input.name = kind;
    input.placeholder = placeholder;
    input.type = inputType;
    input.value = value;
    input.disabled = busyStates[kind];
    input.addEventListener('input', () => {
      onInput(input.value);
      saveButton.disabled = busyStates[kind] || !isDirtyState();
    });

    const saveButton = createElement('button', 'settings-modal__action-button');
    saveButton.type = 'submit';
    saveButton.disabled = busyStates[kind] || !isDirty;
    saveButton.textContent = busyStates[kind] ? busyLabel : actionLabel;

    const isDirtyState = (): boolean => {
      if (kind === 'password') {
        return draftPassword.trim().length > 0;
      }

      return kind === 'name'
        ? normalizeDisplayName(draftName) !== committedName
        : draftEmail.trim() !== committedEmail;
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void onSubmit();
    });

    form.append(input, saveButton);
    card.append(form);
    return card;
  };

  const buildAccountPanel = (): HTMLElement => {
    const section = createElement('section', 'settings-modal__panel-section');
    const grid = createElement('div', 'settings-modal__account-grid');

    grid.append(
      buildAccountFormCard(
        'name',
        messages.account.name.label,
        messages.account.name.description,
        draftName,
        messages.account.name.placeholder,
        messages.account.name.action,
        messages.account.name.busy,
        'text',
        normalizeDisplayName(draftName) !== committedName,
        (nextValue) => {
          draftName = nextValue;
        },
        async () => {
          const nextName = normalizeDisplayName(draftName);

          if (nextName.length < 2) {
            setFeedback({
              message: messages.feedback.nameInvalid,
              tone: 'error',
            });
            return;
          }

          try {
            const result = await runAction('name', () => options.onSaveName(nextName));

            if (isApplied(result)) {
              committedName = nextName;
              draftName = nextName;
            }

            setFeedback({
              message:
                result?.message ??
                options.i18n.t('menu.profile.feedback.nameUpdated'),
              tone: result?.tone ?? 'success',
            });
          } catch (error) {
            setFeedback({
              message: error instanceof Error ? error.message : messages.feedback.genericFailure,
              tone: 'error',
            });
          }
        },
      ),
      buildAccountFormCard(
        'email',
        messages.account.email.label,
        messages.account.email.description,
        draftEmail,
        messages.account.email.placeholder,
        messages.account.email.action,
        messages.account.email.busy,
        'email',
        draftEmail.trim() !== committedEmail,
        (nextValue) => {
          draftEmail = nextValue;
        },
        async () => {
          const nextEmail = draftEmail.trim();

          if (!isValidEmail(nextEmail)) {
            setFeedback({
              message: messages.feedback.emailInvalid,
              tone: 'error',
            });
            return;
          }

          try {
            const result = await runAction('email', () => options.onSaveEmail(nextEmail));

            if (isApplied(result)) {
              committedEmail = nextEmail;
              draftEmail = nextEmail;
            }

            if (result?.message) {
              setFeedback({
                message: result.message,
                tone: result.tone ?? 'warning',
              });
            }
          } catch (error) {
            setFeedback({
              message: error instanceof Error ? error.message : messages.feedback.genericFailure,
              tone: 'error',
            });
          }
        },
      ),
      buildAccountFormCard(
        'password',
        messages.account.password.label,
        messages.account.password.description,
        draftPassword,
        messages.account.password.placeholder,
        messages.account.password.action,
        messages.account.password.busy,
        'password',
        draftPassword.trim().length > 0,
        (nextValue) => {
          draftPassword = nextValue;
        },
        async () => {
          const nextPassword = draftPassword.trim();

          if (nextPassword.length < 8) {
            setFeedback({
              message: messages.feedback.passwordInvalid,
              tone: 'error',
            });
            return;
          }

          try {
            const result = await runAction('password', () => options.onSavePassword(nextPassword));

            if (isApplied(result)) {
              draftPassword = '';
            }

            if (result?.message) {
              setFeedback({
                message: result.message,
                tone: result.tone ?? 'warning',
              });
            }
          } catch (error) {
            setFeedback({
              message: error instanceof Error ? error.message : messages.feedback.genericFailure,
              tone: 'error',
            });
          }
        },
      ),
    );

    const dangerZone = createElement('section', 'settings-modal__danger-zone');
    const dangerEyebrow = createElement('p', 'settings-modal__danger-eyebrow');
    dangerEyebrow.textContent = messages.account.dangerEyebrow;
    const dangerTitle = createElement('h4', 'settings-modal__danger-title');
    dangerTitle.textContent = messages.account.deleteAction;
    const dangerSummary = createElement('p', 'settings-modal__danger-summary');
    dangerSummary.textContent = messages.account.dangerSummary;
    const dangerButton = createElement(
      'button',
      'settings-modal__action-button settings-modal__action-button--danger',
    );
    dangerButton.type = 'button';
    dangerButton.textContent = messages.account.deleteAction;
    dangerButton.addEventListener('click', () => {
      deleteConfirmationOpen = true;
      renderDeleteConfirmation();
    });

    dangerZone.append(dangerEyebrow, dangerTitle, dangerSummary, dangerButton);
    section.append(grid, dangerZone);
    return section;
  };

  const renderActivePanel = (): void => {
    body.dataset.category = activeCategory;
    headerStats.replaceChildren();
    headerStats.hidden = true;

    if (activeCategory === 'video') {
      body.replaceChildren(buildVideoPanel());
      return;
    }

    if (activeCategory === 'audio') {
      body.replaceChildren(buildAudioPanel());
      return;
    }

    body.replaceChildren(buildAccountPanel());
  };

  const renderDeleteConfirmation = (): void => {
    if (!deleteConfirmationOpen) {
      deleteConfirmation.replaceChildren();
      deleteConfirmation.hidden = true;
      return;
    }

    deleteConfirmation.hidden = false;

    const scrim = createElement('div', 'settings-modal__danger-scrim');
    const card = createElement('div', 'settings-modal__danger-card');
    const warning = createElement('p', 'settings-modal__danger-card-eyebrow');
    warning.textContent = messages.account.dangerEyebrow;
    const title = createElement('h4', 'settings-modal__danger-card-title');
    title.textContent = messages.account.confirmTitle;
    const summary = createElement('p', 'settings-modal__danger-card-summary');
    summary.textContent = messages.account.confirmSummary;
    const hazard = createElement('p', 'settings-modal__danger-card-warning');
    hazard.textContent = messages.account.confirmWarning;
    const actions = createElement('div', 'settings-modal__danger-card-actions');
    const keepButton = createElement(
      'button',
      'settings-modal__action-button settings-modal__action-button--ghost',
    );
    keepButton.type = 'button';
    keepButton.disabled = busyStates.delete;
    keepButton.textContent = messages.account.confirmCancel;
    keepButton.addEventListener('click', () => {
      deleteConfirmationOpen = false;
      renderDeleteConfirmation();
    });

    const deleteButton = createElement(
      'button',
      'settings-modal__action-button settings-modal__action-button--danger',
    );
    deleteButton.type = 'button';
    deleteButton.disabled = busyStates.delete;
    deleteButton.textContent = busyStates.delete
      ? messages.account.deleteBusy
      : messages.account.confirmAction;
    deleteButton.addEventListener('click', () => {
      void (async () => {
        try {
          const result = await runAction('delete', () => options.onDeleteAccount());

          deleteConfirmationOpen = false;
          renderDeleteConfirmation();

          if (result?.message) {
            setFeedback({
              message: result.message,
              tone: result.tone ?? 'warning',
            });
          }
        } catch (error) {
          setFeedback({
            message: error instanceof Error ? error.message : messages.feedback.genericFailure,
            tone: 'error',
          });
        }
      })();
    });

    actions.append(keepButton, deleteButton);
    card.append(warning, title, summary, hazard, actions);
    scrim.append(card);
    deleteConfirmation.replaceChildren(scrim);
  };

  const closeModal = (): void => {
    if (deleteConfirmationOpen) {
      deleteConfirmationOpen = false;
      renderDeleteConfirmation();
      return;
    }

    options.onClose();
  };

  dismissButton.addEventListener('click', closeModal);

  rootElement.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (dropdownOpen && !target.closest('[data-settings-resolution]')) {
      dropdownOpen = false;
      renderActivePanel();
    }

    if (target === rootElement) {
      closeModal();
    }
  });

  rootElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();

    if (dropdownOpen) {
      dropdownOpen = false;
      renderActivePanel();
      return;
    }

    closeModal();
  });

  syncSidebarState();
  syncHeaderCopy();
  setFeedback(null);
  renderActivePanel();
  renderDeleteConfirmation();
  queueMicrotask(() => {
    if (rootElement.isConnected) {
      rootElement.focus();
    }
  });

  return rootElement;
}
