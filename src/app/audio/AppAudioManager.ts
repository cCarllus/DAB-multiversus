import { STORAGE_KEYS } from '@shared/constants/storageKeys';
import type { TransitionCueId, UiCueId } from '@shared/types/audio';

const INTERACTIVE_SELECTOR = 'button, [data-action], a[href]';

interface ToneOptions {
  duration: number;
  endFrequency: number;
  frequency: number;
  gain: number;
  type: OscillatorType;
}

export class AppAudioManager {
  private ambienceNodes: AudioNode[] = [];

  private ambienceGain: GainNode | null = null;

  private audioContext: AudioContext | null = null;

  private hoverTarget: HTMLElement | null = null;

  private isUnlocked = false;

  private masterGain: GainNode | null = null;

  private muted = this.readMutePreference();

  private uiGain: GainNode | null = null;

  public bindInteractionSurface(surface: HTMLElement): void {
    surface.addEventListener('pointerdown', this.handleUnlock, { capture: true, once: true });
    surface.addEventListener('keydown', this.handleUnlock, { capture: true, once: true });
    surface.addEventListener('pointerover', this.handlePointerOver, true);
    surface.addEventListener('pointerout', this.handlePointerOut, true);
    surface.addEventListener('click', this.handleClick, true);
  }

  public isMuted(): boolean {
    return this.muted;
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
    this.muted = !this.muted;
    this.persistMutePreference();

    if (this.audioContext && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : 0.9,
        this.audioContext.currentTime,
        0.03,
      );
    }

    return this.muted;
  }

  public startMenuAmbience(): void {
    const context = this.ensureContext();

    if (!context || !this.ambienceGain || this.ambienceNodes.length > 0) {
      return;
    }

    const ambienceBed = context.createGain();
    ambienceBed.gain.value = 0.072;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.8;

    const drone = context.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 52;

    const shimmer = context.createOscillator();
    shimmer.type = 'triangle';
    shimmer.frequency.value = 104;
    shimmer.detune.value = 5;

    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    const lfoDepth = context.createGain();
    lfoDepth.gain.value = 0.015;

    lfo.connect(lfoDepth);
    lfoDepth.connect(ambienceBed.gain);
    drone.connect(filter);
    shimmer.connect(filter);
    filter.connect(ambienceBed);
    ambienceBed.connect(this.ambienceGain);

    drone.start();
    shimmer.start();
    lfo.start();

    this.ambienceNodes = [drone, shimmer, lfo, lfoDepth, filter, ambienceBed];
  }

  public playUiCue(cueId: UiCueId): void {
    if (cueId === 'hover') {
      this.playTone({
        duration: 0.09,
        endFrequency: 720,
        frequency: 480,
        gain: 0.016,
        type: 'triangle',
      });
    }

    if (cueId === 'click') {
      this.playTone({
        duration: 0.14,
        endFrequency: 140,
        frequency: 220,
        gain: 0.03,
        type: 'sawtooth',
      });
      this.playTone({
        duration: 0.08,
        endFrequency: 920,
        frequency: 680,
        gain: 0.012,
        type: 'square',
      });
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
    const ambienceGain = context.createGain();

    masterGain.gain.value = this.muted ? 0 : 0.9;
    uiGain.gain.value = 0.85;
    ambienceGain.gain.value = 0.85;

    uiGain.connect(masterGain);
    ambienceGain.connect(masterGain);
    masterGain.connect(context.destination);

    this.audioContext = context;
    this.masterGain = masterGain;
    this.uiGain = uiGain;
    this.ambienceGain = ambienceGain;

    return context;
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest<HTMLElement>(INTERACTIVE_SELECTOR);

    if (!interactive || this.isDisabled(interactive)) {
      return;
    }

    this.playUiCue('click');
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

    if (!interactive || this.isDisabled(interactive) || interactive === this.hoverTarget) {
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

    if (!context) {
      return;
    }

    const resumePromise =
      context.state === 'suspended' ? context.resume() : Promise.resolve(context.state);

    void resumePromise
      .then(() => {
        this.startMenuAmbience();
      })
      .catch((error: unknown) => {
        console.warn('Audio unlock failed.', error);
      });
  };

  private isDisabled(element: HTMLElement): boolean {
    return element instanceof HTMLButtonElement ? element.disabled : false;
  }

  private persistMutePreference(): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.audioMuted, JSON.stringify(this.muted));
    } catch (error: unknown) {
      console.warn('Mute preference could not be persisted.', error);
    }
  }

  private playTone(options: ToneOptions): void {
    if (this.muted) {
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

  private readMutePreference(): boolean {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEYS.audioMuted);
      return storedValue ? (JSON.parse(storedValue) as boolean) : false;
    } catch {
      return false;
    }
  }
}
