import { STORAGE_KEYS } from '@shared/constants/storage-keys';
import type { AudioChannel, TransitionCueId, UiCueId } from '@shared/types/audio.types';
import menuBackgroundSoundUrl from '@assets/audio/menu/default_background_sound.ogg';
import confirmButtonsSoundUrl from '@assets/audio/ui/confirm-buttons-sound.ogg';
import mouseClickSoundUrl from '@assets/audio/ui/mouse-click-sound.ogg';
import mouseHoverSoundUrl from '@assets/audio/ui/mouse-hover-sound.ogg';

const INTERACTIVE_SELECTOR = 'button, [data-action], a[href]';
const DEFAULT_MUSIC_VOLUME = 0.5;
const DEFAULT_SOUND_VOLUME = 0.9;
const UI_BUS_VOLUME = 0.85;
const UI_CLICK_VOLUME = 0.78;
const UI_CONFIRM_VOLUME = 0.72;
const UI_HOVER_VOLUME = 0.62;

interface ToneOptions {
  duration: number;
  endFrequency: number;
  frequency: number;
  gain: number;
  type: OscillatorType;
}

export class AppAudioManager {
  private audioContext: AudioContext | null = null;

  private backgroundMusic: HTMLAudioElement | null = null;

  private clickSound: HTMLAudioElement | null = null;

  private confirmSound: HTMLAudioElement | null = null;

  private hoverTarget: HTMLElement | null = null;

  private hoverSound: HTMLAudioElement | null = null;

  private isUnlocked = false;

  private masterGain: GainNode | null = null;

  private musicMuted = false;

  private musicVolume = DEFAULT_MUSIC_VOLUME;

  private soundMuted = false;

  private soundVolume = DEFAULT_SOUND_VOLUME;

  private uiGain: GainNode | null = null;

  public constructor() {
    const mutePreferences = this.readMutePreferences();

    this.musicMuted = mutePreferences.musicMuted;
    this.soundMuted = this.resolveInitialSoundMuted(mutePreferences.soundMuted);
    this.musicVolume = this.readVolumePreference('music', DEFAULT_MUSIC_VOLUME);
    this.soundVolume = this.readVolumePreference('sound', DEFAULT_SOUND_VOLUME);
  }

  public bindInteractionSurface(surface: HTMLElement): void {
    surface.addEventListener('pointerdown', this.handleUnlock, { capture: true, once: true });
    surface.addEventListener('keydown', this.handleUnlock, { capture: true, once: true });
    surface.addEventListener('pointerover', this.handlePointerOver, true);
    surface.addEventListener('pointerout', this.handlePointerOut, true);
    surface.addEventListener('click', this.handleClick, true);
  }

  public isMuted(): boolean {
    return this.musicMuted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public isSoundMuted(): boolean {
    return this.soundMuted;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public getSoundVolume(): number {
    return this.soundVolume;
  }

  public startBackgroundMusic(): void {
    const backgroundMusic = this.ensureBackgroundMusic();

    if (!backgroundMusic || this.musicMuted) {
      return;
    }

    void this.playBackgroundMusic(backgroundMusic);
  }

  public dispose(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
      this.backgroundMusic = null;
    }

    if (this.confirmSound) {
      this.confirmSound.pause();
      this.confirmSound.currentTime = 0;
      this.confirmSound = null;
    }

    if (this.clickSound) {
      this.clickSound.pause();
      this.clickSound.currentTime = 0;
      this.clickSound = null;
    }

    if (this.hoverSound) {
      this.hoverSound.pause();
      this.hoverSound.currentTime = 0;
      this.hoverSound = null;
    }
  }

  public playTransitionCue(cueId: TransitionCueId): void {
    if (cueId === 'screen-shift') {
      this.playTone({
        duration: 0.28,
        endFrequency: 260,
        frequency: 148,
        gain: 0.032,
        type: 'sine',
      });
      this.playTone({
        duration: 0.16,
        endFrequency: 520,
        frequency: 320,
        gain: 0.012,
        type: 'triangle',
      });
    }
  }

  public toggleMute(): boolean {
    return this.toggleMusicMute();
  }

  public toggleMusicMute(): boolean {
    this.musicMuted = !this.musicMuted;
    this.persistMutePreference('music');
    this.applyMusicState();

    if (!this.musicMuted && this.backgroundMusic) {
      void this.playBackgroundMusic(this.backgroundMusic);
    }

    return this.musicMuted;
  }

  public toggleSoundMute(): boolean {
    this.soundMuted = !this.soundMuted;
    this.persistMutePreference('sound');
    this.applySoundState();

    return this.soundMuted;
  }

  public setMusicVolume(volume: number): number {
    this.musicVolume = this.clampVolume(volume);
    this.persistVolumePreference('music');
    this.applyMusicState();
    return this.musicVolume;
  }

  public setSoundVolume(volume: number): number {
    this.soundVolume = this.clampVolume(volume);
    this.persistVolumePreference('sound');
    this.applySoundState();
    return this.soundVolume;
  }

  public playUiCue(cueId: UiCueId): void {
    if (cueId === 'hover') {
      this.playBufferedCue('hover');
    }

    if (cueId === 'click') {
      this.playBufferedCue('click');
    }

    if (cueId === 'confirm') {
      this.playBufferedCue('confirm');
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }

    if (typeof window === 'undefined' || !window.AudioContext) {
      return null;
    }

    const context = new window.AudioContext();
    const masterGain = context.createGain();
    const uiGain = context.createGain();

    masterGain.gain.value = this.soundMuted ? 0 : this.soundVolume;
    uiGain.gain.value = UI_BUS_VOLUME;

    uiGain.connect(masterGain);
    masterGain.connect(context.destination);

    this.audioContext = context;
    this.masterGain = masterGain;
    this.uiGain = uiGain;

    return context;
  }

  private ensureBackgroundMusic(): HTMLAudioElement | null {
    if (this.backgroundMusic) {
      return this.backgroundMusic;
    }

    if (typeof window === 'undefined' || !window.Audio) {
      return null;
    }

    const backgroundMusic = new window.Audio(menuBackgroundSoundUrl);
    backgroundMusic.loop = true;
    backgroundMusic.preload = 'metadata';
    backgroundMusic.volume = this.musicVolume;
    backgroundMusic.muted = this.musicMuted;

    this.backgroundMusic = backgroundMusic;

    return backgroundMusic;
  }

  private ensureConfirmSound(): HTMLAudioElement | null {
    if (this.confirmSound) {
      return this.confirmSound;
    }

    if (typeof window === 'undefined' || !window.Audio) {
      return null;
    }

    const confirmSound = new window.Audio(confirmButtonsSoundUrl);
    confirmSound.preload = 'auto';
    confirmSound.volume = UI_CONFIRM_VOLUME * this.soundVolume;
    confirmSound.muted = this.soundMuted;

    this.confirmSound = confirmSound;

    return confirmSound;
  }

  private ensureClickSound(): HTMLAudioElement | null {
    if (this.clickSound) {
      return this.clickSound;
    }

    if (typeof window === 'undefined' || !window.Audio) {
      return null;
    }

    const clickSound = new window.Audio(mouseClickSoundUrl);
    clickSound.preload = 'auto';
    clickSound.volume = UI_CLICK_VOLUME * this.soundVolume;
    clickSound.muted = this.soundMuted;

    this.clickSound = clickSound;

    return clickSound;
  }

  private ensureHoverSound(): HTMLAudioElement | null {
    if (this.hoverSound) {
      return this.hoverSound;
    }

    if (typeof window === 'undefined' || !window.Audio) {
      return null;
    }

    const hoverSound = new window.Audio(mouseHoverSoundUrl);
    hoverSound.preload = 'auto';
    hoverSound.volume = UI_HOVER_VOLUME * this.soundVolume;
    hoverSound.muted = this.soundMuted;

    this.hoverSound = hoverSound;

    return hoverSound;
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest<HTMLElement>(INTERACTIVE_SELECTOR);

    if (!interactive || this.isDisabled(interactive) || this.isUiCueSuppressed(interactive)) {
      return;
    }

    const cue = this.resolveUiCue(interactive);
    this.playUiCue(cue);
  };

  private readonly handlePointerOut = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest<HTMLElement>(INTERACTIVE_SELECTOR);

    if (!interactive || interactive !== this.hoverTarget) {
      return;
    }

    const relatedTarget =
      event instanceof MouseEvent || event instanceof PointerEvent
        ? (event.relatedTarget as Node | null)
        : null;

    if (!relatedTarget || !interactive.contains(relatedTarget)) {
      this.hoverTarget = null;
    }
  };

  private readonly handlePointerOver = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest<HTMLElement>(INTERACTIVE_SELECTOR);

    if (
      !interactive ||
      this.isDisabled(interactive) ||
      this.isUiCueSuppressed(interactive) ||
      interactive === this.hoverTarget
    ) {
      return;
    }

    this.hoverTarget = interactive;
    this.playUiCue('hover');
  };

  private readonly handleUnlock = (): void => {
    if (this.isUnlocked) {
      return;
    }

    this.isUnlocked = true;

    const context = this.ensureContext();

    if (context) {
      const resumePromise =
        context.state === 'suspended' ? context.resume() : Promise.resolve(context.state);

      void resumePromise
        .then(() => undefined)
        .catch((error: unknown) => {
          console.warn('Audio unlock failed.', error);
        });
    }

    const backgroundMusic = this.ensureBackgroundMusic();

    if (!backgroundMusic || this.musicMuted) {
      return;
    }

    void this.playBackgroundMusic(backgroundMusic);
  };

  private isDisabled(element: HTMLElement): boolean {
    return element instanceof HTMLButtonElement ? element.disabled : false;
  }

  private isUiCueSuppressed(element: HTMLElement): boolean {
    return element.dataset.uiSilent === 'true' || element.closest('[data-ui-silent="true"]') !== null;
  }

  private persistMutePreference(channel: AudioChannel): void {
    try {
      window.localStorage.setItem(
        channel === 'music' ? STORAGE_KEYS.musicMuted : STORAGE_KEYS.soundMuted,
        JSON.stringify(channel === 'music' ? this.musicMuted : this.soundMuted),
      );
    } catch (error: unknown) {
      console.warn('Mute preference could not be persisted.', error);
    }
  }

  private persistVolumePreference(channel: AudioChannel): void {
    try {
      window.localStorage.setItem(
        channel === 'music' ? STORAGE_KEYS.musicVolume : STORAGE_KEYS.soundVolume,
        JSON.stringify(channel === 'music' ? this.musicVolume : this.soundVolume),
      );
    } catch (error: unknown) {
      console.warn('Volume preference could not be persisted.', error);
    }
  }

  private playTone(options: ToneOptions): void {
    if (this.soundMuted) {
      return;
    }

    const context = this.ensureContext();

    if (!context || !this.uiGain || context.state !== 'running') {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const now = context.currentTime;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(options.endFrequency, 1),
      now + options.duration,
    );

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(options.gain, now + 0.016);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.uiGain);

    oscillator.start(now);
    oscillator.stop(now + options.duration + 0.02);
  }

  private playBufferedCue(cueId: 'click' | 'confirm' | 'hover'): void {
    if (this.soundMuted) {
      return;
    }

    const audioElement =
      cueId === 'hover'
        ? this.ensureHoverSound()
        : cueId === 'click'
          ? this.ensureClickSound()
          : cueId === 'confirm'
            ? this.ensureConfirmSound()
            : null;

    const volume =
      cueId === 'hover'
        ? UI_HOVER_VOLUME * this.soundVolume
        : cueId === 'click'
          ? UI_CLICK_VOLUME * this.soundVolume
          : UI_CONFIRM_VOLUME * this.soundVolume;

    if (!audioElement) {
      return;
    }

    audioElement.currentTime = 0;
    audioElement.muted = this.soundMuted;
    audioElement.volume = volume;

    void audioElement.play().catch((error: unknown) => {
      console.warn(`UI cue "${cueId}" could not start.`, error);
    });
  }

  private async playBackgroundMusic(backgroundMusic: HTMLAudioElement): Promise<void> {
    try {
      await backgroundMusic.play();
    } catch (error: unknown) {
      console.warn('Menu background music could not start automatically.', error);
    }
  }

  private readMutePreferences(): { musicMuted: boolean; soundMuted: boolean } {
    try {
      const storedMusicMuted = this.readStoredBoolean(STORAGE_KEYS.musicMuted);
      const storedSoundMuted = this.readStoredBoolean(STORAGE_KEYS.soundMuted);

      if (storedMusicMuted !== null || storedSoundMuted !== null) {
        return {
          musicMuted: storedMusicMuted ?? false,
          soundMuted: storedSoundMuted ?? false,
        };
      }

      const legacyMuted = this.readStoredBoolean(STORAGE_KEYS.audioMuted);

      if (legacyMuted !== null) {
        this.migrateLegacyMutePreference(legacyMuted);
      }

      return {
        musicMuted: legacyMuted ?? false,
        soundMuted: false,
      };
    } catch {
      return {
        musicMuted: false,
        soundMuted: false,
      };
    }
  }

  private readStoredBoolean(key: string): boolean | null {
    const storedValue = window.localStorage.getItem(key);

    if (storedValue === null) {
      return null;
    }

    return Boolean(JSON.parse(storedValue) as boolean);
  }

  private readVolumePreference(channel: AudioChannel, fallback: number): number {
    try {
      const channelKey = channel === 'music' ? STORAGE_KEYS.musicVolume : STORAGE_KEYS.soundVolume;
      const storedValue = window.localStorage.getItem(channelKey);

      if (storedValue === null) {
        return fallback;
      }

      const parsedValue = Number(JSON.parse(storedValue));
      return Number.isFinite(parsedValue) ? this.clampVolume(parsedValue) : fallback;
    } catch {
      return fallback;
    }
  }

  private applyMusicState(): void {
    if (!this.backgroundMusic) {
      return;
    }

    this.backgroundMusic.volume = this.musicVolume;
    this.backgroundMusic.muted = this.musicMuted;
  }

  private applySoundState(): void {
    if (this.audioContext && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.soundMuted ? 0 : this.soundVolume,
        this.audioContext.currentTime,
        0.03,
      );
    }

    if (this.confirmSound) {
      this.confirmSound.muted = this.soundMuted;
      this.confirmSound.volume = UI_CONFIRM_VOLUME * this.soundVolume;
    }

    if (this.clickSound) {
      this.clickSound.muted = this.soundMuted;
      this.clickSound.volume = UI_CLICK_VOLUME * this.soundVolume;
    }

    if (this.hoverSound) {
      this.hoverSound.muted = this.soundMuted;
      this.hoverSound.volume = UI_HOVER_VOLUME * this.soundVolume;
    }
  }

  private clampVolume(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private migrateLegacyMutePreference(legacyMuted: boolean): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.musicMuted, JSON.stringify(legacyMuted));
      window.localStorage.setItem(STORAGE_KEYS.soundMuted, JSON.stringify(false));
      window.localStorage.removeItem(STORAGE_KEYS.audioMuted);
    } catch (error: unknown) {
      console.warn('Legacy mute preference could not be migrated.', error);
    }
  }

  private resolveInitialSoundMuted(storedSoundMuted: boolean): boolean {
    if (!storedSoundMuted) {
      return false;
    }

    try {
      // The launcher currently exposes only music mute controls in the UI.
      // Reset stale sound-mute state so effect cues do not get trapped off.
      window.localStorage.setItem(STORAGE_KEYS.soundMuted, JSON.stringify(false));
    } catch (error: unknown) {
      console.warn('Sound mute preference could not be normalized.', error);
    }

    return false;
  }

  private resolveUiCue(interactive: HTMLElement): UiCueId {
    const cue = interactive.dataset.uiCue;

    if (cue === 'hover' || cue === 'click' || cue === 'confirm') {
      return cue;
    }

    return 'click';
  }
}
