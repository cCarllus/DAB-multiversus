export interface InteractionConfig {
  longPressThreshold: number;
  dragMoveThreshold: number;
}

export class CardInteractionController {
  private pressedSlug: string | null = null;
  private pressStartX = 0;
  private pressStartY = 0;
  private moved = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: InteractionConfig,
    private readonly onLongPress: (slug: string) => void,
    private readonly schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
    private readonly unschedule: (id: ReturnType<typeof setTimeout>) => void = clearTimeout,
  ) {}

  handlePointerDown(slug: string, x: number, y: number): void {
    this.cancelTimer();
    this.pressedSlug = slug;
    this.pressStartX = x;
    this.pressStartY = y;
    this.moved = false;

    this.longPressTimer = this.schedule(() => {
      if (!this.moved && this.pressedSlug !== null) {
        const slug = this.pressedSlug;
        this.pressedSlug = null;
        this.onLongPress(slug);
      }
    }, this.config.longPressThreshold);
  }

  handlePointerMove(x: number, y: number): void {
    if (this.pressedSlug === null) {
      return;
    }

    const dx = Math.abs(x - this.pressStartX);
    const dy = Math.abs(y - this.pressStartY);

    if (dx > this.config.dragMoveThreshold || dy > this.config.dragMoveThreshold) {
      this.moved = true;
      this.cancelTimer();
    }
  }

  handlePointerUp(): void {
    this.cancelTimer();
    this.pressedSlug = null;
  }

  handleDragStart(): void {
    this.cancelTimer();
    this.pressedSlug = null;
  }

  dispose(): void {
    this.cancelTimer();
    this.pressedSlug = null;
  }

  private cancelTimer(): void {
    if (this.longPressTimer !== null) {
      this.unschedule(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
