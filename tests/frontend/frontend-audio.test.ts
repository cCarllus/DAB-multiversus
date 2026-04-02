// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppAudioManager } from '../../app/frontend/services/audio/app-audio.service';
import { STORAGE_KEYS } from '../../app/shared/constants/storage-keys';

class MockGainNode {
  connect = vi.fn();

  gain = {
    value: 0,
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
  };
}

class MockOscillatorNode {
  connect = vi.fn();

  frequency = {
    exponentialRampToValueAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
  };

  start = vi.fn();

  stop = vi.fn();

  type: OscillatorType = 'sine';
}

class MockAudioContext {
  createGain = vi.fn(() => new MockGainNode());

  createOscillator = vi.fn(() => new MockOscillatorNode());

  currentTime = 1;

  destination = {};

  resume = vi.fn(async () => 'running');

  state: AudioContextState = 'running';
}

class MockAudio {
  currentTime = 0;

  loop = false;

  muted = false;

  pause = vi.fn();

  play = vi.fn(async () => undefined);

  playsInline = false;

  preload = '';

  src: string;

  volume = 1;

  defaultMuted = false;

  autoplay = false;

  constructor(src: string) {
    this.src = src;
  }
}

describe('frontend audio manager', () => {
  const originalAudio = window.Audio;
  const originalAudioContext = window.AudioContext;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    localStorage.clear();
    window.Audio = MockAudio as never;
    window.AudioContext = MockAudioContext as never;
  });

  afterEach(() => {
    window.Audio = originalAudio;
    window.AudioContext = originalAudioContext;
    vi.restoreAllMocks();
  });

  it('initializes from stored preferences and controls music and sound state', async () => {
    localStorage.setItem(STORAGE_KEYS.audioMuted, JSON.stringify(true));
    localStorage.setItem(STORAGE_KEYS.musicMuted, JSON.stringify(true));
    localStorage.setItem(STORAGE_KEYS.soundMuted, JSON.stringify(true));
    localStorage.setItem(STORAGE_KEYS.musicVolume, JSON.stringify(0.25));
    localStorage.setItem(STORAGE_KEYS.soundVolume, JSON.stringify(1.5));

    const manager = new AppAudioManager();

    expect(manager.isMuted()).toBe(true);
    expect(manager.isMusicMuted()).toBe(true);
    expect(manager.isSoundMuted()).toBe(false);
    expect(manager.getMusicVolume()).toBe(0.25);
    expect(manager.getSoundVolume()).toBe(1);
    expect(localStorage.getItem(STORAGE_KEYS.soundMuted)).toBe('false');

    manager.startBackgroundMusic();
    expect(manager.isMusicMuted()).toBe(true);

    expect(manager.toggleMute()).toBe(false);
    expect(manager.isMusicMuted()).toBe(false);
    expect(manager.toggleSoundMute()).toBe(true);
    expect(manager.isSoundMuted()).toBe(true);
    expect(manager.setMusicVolume(-2)).toBe(0);
    expect(manager.setSoundVolume(2)).toBe(1);

    manager.playUiCue('hover');
    manager.playUiCue('click');
    manager.playUiCue('confirm');
    manager.playTransitionCue('screen-shift');

    manager.dispose();
    expect((manager as unknown as { backgroundMusic: MockAudio | null }).backgroundMusic).toBeNull();
    expect((manager as unknown as { confirmSound: MockAudio | null }).confirmSound).toBeNull();

    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.audioMuted, JSON.stringify(true));
    const legacyManager = new AppAudioManager();
    expect(legacyManager.isMusicMuted()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.audioMuted)).toBeNull();
  });

  it('binds interaction surfaces and reacts to click, hover, pointer out, and unload paths', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const manager = new AppAudioManager();
    const host = document.createElement('div');
    host.innerHTML = `
      <button id="normal" data-ui-cue="confirm">Normal</button>
      <button id="disabled" disabled>Disabled</button>
      <div id="silent" data-ui-silent="true"><button id="inner-silent">Silent</button></div>
      <a id="link" href="#x">Link</a>
    `;
    document.body.append(host);

    manager.bindInteractionSurface(host);

    const normal = host.querySelector<HTMLElement>('#normal')!;
    const disabled = host.querySelector<HTMLElement>('#disabled')!;
    const innerSilent = host.querySelector<HTMLElement>('#inner-silent')!;
    const link = host.querySelector<HTMLElement>('#link')!;

    host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    host.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));

    normal.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    normal.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    normal.dispatchEvent(
      new PointerEvent('pointerout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
    normal.click();
    disabled.click();
    innerSilent.click();
    link.click();

    expect(manager.isMusicMuted()).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reuses cached audio resources and updates gain nodes and element state across branches', () => {
    localStorage.setItem(STORAGE_KEYS.musicVolume, JSON.stringify('bad'));
    localStorage.setItem(STORAGE_KEYS.soundVolume, JSON.stringify(null));

    const manager = new AppAudioManager();
    const audiolessManager = new AppAudioManager();

    expect(
      (audiolessManager as unknown as { applyMusicState: () => void }).applyMusicState(),
    ).toBeUndefined();
    expect(
      (manager as unknown as { readStoredBoolean: (key: string) => boolean | null }).readStoredBoolean(
        STORAGE_KEYS.musicMuted,
      ),
    ).toBeNull();
    expect(
      (manager as unknown as { readVolumePreference: (channel: 'music', fallback: number) => number }).readVolumePreference(
        'music',
        0.2,
      ),
    ).toBe(0.2);
    expect(
      (manager as unknown as { clampVolume: (value: number) => number }).clampVolume(0.25),
    ).toBe(0.25);
    expect(
      (manager as unknown as { resolveInitialSoundMuted: (stored: boolean) => boolean }).resolveInitialSoundMuted(
        false,
      ),
    ).toBe(false);

    const context = (manager as unknown as { ensureContext: () => MockAudioContext }).ensureContext();
    const backgroundMusic = (
      manager as unknown as { ensureBackgroundMusic: () => MockAudio }
    ).ensureBackgroundMusic();
    const confirmSound = (manager as unknown as { ensureConfirmSound: () => MockAudio }).ensureConfirmSound();
    const clickSound = (manager as unknown as { ensureClickSound: () => MockAudio }).ensureClickSound();
    const hoverSound = (manager as unknown as { ensureHoverSound: () => MockAudio }).ensureHoverSound();

    expect((manager as unknown as { ensureContext: () => MockAudioContext }).ensureContext()).toBe(context);
    expect(
      (manager as unknown as { ensureBackgroundMusic: () => MockAudio }).ensureBackgroundMusic(),
    ).toBe(backgroundMusic);
    expect((manager as unknown as { ensureConfirmSound: () => MockAudio }).ensureConfirmSound()).toBe(
      confirmSound,
    );
    expect((manager as unknown as { ensureClickSound: () => MockAudio }).ensureClickSound()).toBe(
      clickSound,
    );
    expect((manager as unknown as { ensureHoverSound: () => MockAudio }).ensureHoverSound()).toBe(
      hoverSound,
    );

    context.state = 'running';
    (manager as unknown as { playTone: (options: object) => void }).playTone({
      duration: 0.25,
      endFrequency: 0.2,
      frequency: 200,
      gain: 0.1,
      type: 'triangle',
    });
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    const oscillator = context.createOscillator.mock.results[0]?.value as MockOscillatorNode;
    expect(oscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1, 1.25);
    expect(oscillator.start).toHaveBeenCalledWith(1);
    expect(oscillator.stop).toHaveBeenCalledWith(1.27);

    manager.setMusicVolume(0.3);
    expect(backgroundMusic.volume).toBe(0.3);
    expect(backgroundMusic.muted).toBe(false);

    manager.setSoundVolume(0.4);
    expect(context.createGain.mock.results[0]?.value.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.4,
      1,
      0.03,
    );
    expect(confirmSound.volume).toBeCloseTo(0.72 * 0.4);
    expect(clickSound.volume).toBeCloseTo(0.78 * 0.4);
    expect(hoverSound.volume).toBeCloseTo(0.62 * 0.4);

    manager.toggleSoundMute();
    expect(confirmSound.muted).toBe(true);
    expect(clickSound.muted).toBe(true);
    expect(hoverSound.muted).toBe(true);

    const confirmButton = document.createElement('button');
    confirmButton.dataset.uiCue = 'confirm';
    expect(
      (manager as unknown as { resolveUiCue: (element: HTMLElement) => string }).resolveUiCue(
        confirmButton,
      ),
    ).toBe('confirm');
  });

  it('covers unlock, storage warning, and private fallback branches', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => {
          if (key === STORAGE_KEYS.soundMuted) {
            return JSON.stringify(true);
          }

          return null;
        },
        removeItem: () => {
          throw new Error('remove failed');
        },
        setItem: () => {
          throw new Error('set failed');
        },
      },
    });

    const manager = new AppAudioManager();
    const context = (manager as unknown as { ensureContext: () => MockAudioContext }).ensureContext();
    context.state = 'suspended';
    context.resume = vi.fn(async () => {
      throw new Error('resume failed');
    });

    const button = document.createElement('button');
    button.textContent = 'Play';
    document.body.append(button);

    (manager as unknown as { handleUnlock: () => void }).handleUnlock();
    await Promise.resolve();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith('Audio unlock failed.', expect.any(Error));

    (manager as unknown as { handleUnlock: () => void }).handleUnlock();
    expect(context.resume).toHaveBeenCalledTimes(1);

    manager.toggleMusicMute();
    manager.toggleSoundMute();
    manager.setMusicVolume(0.6);
    manager.setSoundVolume(0.7);

    expect(warnSpy).toHaveBeenCalledWith('Mute preference could not be persisted.', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith(
      'Volume preference could not be persisted.',
      expect.any(Error),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Sound mute preference could not be normalized.',
      expect.any(Error),
    );

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) =>
          key === STORAGE_KEYS.audioMuted ? JSON.stringify(true) : null,
        removeItem: () => {
          throw new Error('remove failed');
        },
        setItem: () => {
          throw new Error('set failed');
        },
      },
    });

    new AppAudioManager();
    expect(warnSpy).toHaveBeenCalledWith(
      'Legacy mute preference could not be migrated.',
      expect.any(Error),
    );
  });

  it('handles missing browser audio APIs and internal private branches', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('no storage');
        },
        removeItem: () => {
          throw new Error('no storage');
        },
        setItem: () => {
          throw new Error('no storage');
        },
      },
    });
    window.Audio = undefined as never;
    window.AudioContext = undefined as never;
    const manager = new AppAudioManager();

    expect((manager as unknown as { ensureContext: () => AudioContext | null }).ensureContext()).toBeNull();
    expect(
      (manager as unknown as { ensureBackgroundMusic: () => HTMLAudioElement | null }).ensureBackgroundMusic(),
    ).toBeNull();
    expect(
      (manager as unknown as { ensureConfirmSound: () => HTMLAudioElement | null }).ensureConfirmSound(),
    ).toBeNull();
    expect(
      (manager as unknown as { ensureClickSound: () => HTMLAudioElement | null }).ensureClickSound(),
    ).toBeNull();
    expect(
      (manager as unknown as { ensureHoverSound: () => HTMLAudioElement | null }).ensureHoverSound(),
    ).toBeNull();
    expect(
      (manager as unknown as { resolveInteractiveTarget: (event: Event) => HTMLElement | null }).resolveInteractiveTarget(
        new Event('click'),
      ),
    ).toBeNull();
    expect(
      (manager as unknown as { resolveUiCue: (element: HTMLElement) => string }).resolveUiCue(
        (() => {
          const button = document.createElement('button');
          button.dataset.uiCue = 'hover';
          return button;
        })(),
      ),
    ).toBe('hover');
    expect(
      (manager as unknown as { resolveUiCue: (element: HTMLElement) => string }).resolveUiCue(
        document.createElement('button'),
      ),
    ).toBe('click');

    (manager as unknown as { playTone: (input: object) => void }).playTone({
      duration: 1,
      endFrequency: 2,
      frequency: 3,
      gain: 4,
      type: 'sine',
    });
    (manager as unknown as { playBufferedCue: (cueId: 'hover' | 'click' | 'confirm') => void }).playBufferedCue(
      'hover',
    );
    await (manager as unknown as { playBackgroundMusic: (audio: MockAudio) => Promise<void> }).playBackgroundMusic(
      Object.assign(new MockAudio('src'), {
        play: vi.fn(async () => {
          throw new Error('play failed');
        }),
      }),
    );
    expect(
      (manager as unknown as { playBufferedCue: (cueId: 'confirm') => void }).playBufferedCue('confirm'),
    ).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});
