export interface LauncherHistorySnapshot<TEntry> {
  canGoBack: boolean;
  canGoForward: boolean;
  current: TEntry;
  entries: TEntry[];
  index: number;
}

interface CreateLauncherHistoryOptions<TEntry> {
  compare?: (left: TEntry, right: TEntry) => boolean;
  initial: TEntry;
}

export interface LauncherHistoryController<TEntry> {
  back: () => TEntry | null;
  forward: () => TEntry | null;
  getSnapshot: () => LauncherHistorySnapshot<TEntry>;
  push: (entry: TEntry) => LauncherHistorySnapshot<TEntry>;
  reset: (entry: TEntry) => LauncherHistorySnapshot<TEntry>;
}

export function createLauncherHistory<TEntry>(
  options: CreateLauncherHistoryOptions<TEntry>,
): LauncherHistoryController<TEntry> {
  const compare = options.compare ?? ((left: TEntry, right: TEntry) => left === right);
  let entries = [options.initial];
  let index = 0;

  const getSnapshot = (): LauncherHistorySnapshot<TEntry> => ({
    canGoBack: index > 0,
    canGoForward: index < entries.length - 1,
    current: entries[index]!,
    entries: [...entries],
    index,
  });

  return {
    back() {
      if (index <= 0) {
        return null;
      }

      index -= 1;
      return entries[index]!;
    },

    forward() {
      if (index >= entries.length - 1) {
        return null;
      }

      index += 1;
      return entries[index]!;
    },

    getSnapshot,

    push(entry) {
      const currentEntry = entries[index];

      if (currentEntry && compare(currentEntry, entry)) {
        return getSnapshot();
      }

      entries = [...entries.slice(0, index + 1), entry];
      index = entries.length - 1;
      return getSnapshot();
    },

    reset(entry) {
      entries = [entry];
      index = 0;
      return getSnapshot();
    },
  };
}
