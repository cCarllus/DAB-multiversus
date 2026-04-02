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
    expect(warnSpy).toHaveBeenCalled();
  });
});
