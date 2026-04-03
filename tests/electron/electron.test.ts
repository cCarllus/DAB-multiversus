import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => {
  const appHandlers = new Map<string, (...args: unknown[]) => void>();
  const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcRendererListeners = new Map<string, (...args: unknown[]) => void>();
  const shellOpenExternal = vi.fn(async () => undefined);

  class MockBrowserWindow {
    static allWindows: MockBrowserWindow[] = [];

    static fromWebContents = vi.fn(() => MockBrowserWindow.allWindows[0] ?? null);

    static getAllWindows = vi.fn(() => MockBrowserWindow.allWindows);

    loadFile = vi.fn(async () => undefined);

    loadURL = vi.fn(async () => undefined);

    maximize = vi.fn(() => {
      this.maximized = true;
    });

    center = vi.fn();

    contentHeight: number;

    contentWidth: number;

    fullscreen = false;

    fullscreenable = true;

    maximizable = true;

    minimized = false;

    minimizable = true;

    once = vi.fn((event: string, handler: () => void) => {
      if (event === 'ready-to-show') {
        this.readyToShowHandler = handler;
      }
    });

    on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      this.events.set(event, handler);
    });

    removeAllListeners = vi.fn();

    destroy = vi.fn();

    show = vi.fn();

    setContentSize = vi.fn((width: number, height: number) => {
      this.contentWidth = width;
      this.contentHeight = height;
    });

    setFullScreen = vi.fn((enabled: boolean) => {
      this.fullscreen = enabled;
    });

    unmaximize = vi.fn(() => {
      this.maximized = false;
    });

    maximized = false;

    events = new Map<string, (...args: unknown[]) => void>();

    readyToShowHandler: (() => void) | null = null;

    webContents = {
      once: vi.fn((event: string, handler: () => void) => {
        if (event === 'did-finish-load') {
          this.didFinishLoadHandler = handler;
        }
      }),
      send: vi.fn(),
      setWindowOpenHandler: vi.fn((handler: (payload: { url: string }) => { action: string }) => {
        this.windowOpenHandler = handler;
      }),
    };

    didFinishLoadHandler: (() => void) | null = null;

    windowOpenHandler: ((payload: { url: string }) => { action: string }) | null = null;

    constructor(public readonly options: Record<string, unknown>) {
      this.contentWidth = typeof options.width === 'number' ? options.width : 1680;
      this.contentHeight = typeof options.height === 'number' ? options.height : 1020;
      MockBrowserWindow.allWindows.push(this);
    }

    getContentSize(): [number, number] {
      return [this.contentWidth, this.contentHeight];
    }

    isFullScreen(): boolean {
      return this.fullscreen;
    }

    isFullScreenable(): boolean {
      return this.fullscreenable;
    }

    isMaximized(): boolean {
      return this.maximized;
    }

    isMaximizable(): boolean {
      return this.maximizable;
    }

    isMinimizable(): boolean {
      return this.minimizable;
    }

    isMinimized(): boolean {
      return this.minimized;
    }

    minimize(): void {
      this.minimized = true;
    }
  }

  const app = {
    dock: {
      setIcon: vi.fn(),
    },
    exit: vi.fn(),
    getPath: vi.fn(() => '/tmp/dab-user-data'),
    isPackaged: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      appHandlers.set(event, handler);
      return app;
    }),
    quit: vi.fn(),
    setName: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  };

  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  };

  const ipcRenderer = {
    invoke: vi.fn(async (channel: string, ...args: unknown[]) => ({ channel, args })),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      ipcRendererListeners.set(channel, handler);
    }),
    removeListener: vi.fn((channel: string) => {
      ipcRendererListeners.delete(channel);
    }),
  };

  const contextBridge = {
    exposeInMainWorld: vi.fn(),
  };

  const safeStorage = {
    decryptString: vi.fn((value: Buffer) => value.toString('utf8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
    isEncryptionAvailable: vi.fn(() => true),
  };

  return {
    MockBrowserWindow,
    app,
    appHandlers,
    contextBridge,
    ipcHandlers,
    ipcMain,
    ipcRenderer,
    ipcRendererListeners,
    safeStorage,
    shell: {
      openExternal: shellOpenExternal,
    },
  };
});

const fsState = vi.hoisted(() => ({
  readFile: vi.fn(),
  rm: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

vi.mock('electron', () => ({
  BrowserWindow: electronState.MockBrowserWindow,
  app: electronState.app,
  contextBridge: electronState.contextBridge,
  ipcMain: electronState.ipcMain,
  ipcRenderer: electronState.ipcRenderer,
  safeStorage: electronState.safeStorage,
  shell: electronState.shell,
}));

vi.mock('node:fs', () => ({
  promises: {
    readFile: fsState.readFile,
    rm: fsState.rm,
    writeFile: fsState.writeFile,
  },
}));

describe('electron modules', () => {
  beforeEach(() => {
    electronState.MockBrowserWindow.allWindows = [];
    electronState.MockBrowserWindow.getAllWindows.mockImplementation(
      () => electronState.MockBrowserWindow.allWindows,
    );
    electronState.MockBrowserWindow.fromWebContents.mockImplementation(
      () => electronState.MockBrowserWindow.allWindows[0] ?? null,
    );
    electronState.appHandlers.clear();
    electronState.ipcHandlers.clear();
    electronState.ipcRendererListeners.clear();
    electronState.app.whenReady.mockImplementation(() => Promise.resolve());
    electronState.app.getPath.mockImplementation(() => '/tmp/dab-user-data');
    electronState.app.isPackaged = false;
    electronState.safeStorage.isEncryptionAvailable.mockReturnValue(true);
    electronState.safeStorage.encryptString.mockImplementation((value: string) =>
      Buffer.from(value, 'utf8'),
    );
    electronState.safeStorage.decryptString.mockImplementation((value: Buffer) =>
      value.toString('utf8'),
    );
    fsState.readFile.mockReset();
    fsState.writeFile.mockReset();
    fsState.rm.mockReset();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.VITE_DEV_SERVER_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('registers auth storage handlers for encrypted and development fallback persistence', async () => {
    const { AUTH_STORAGE_CHANNELS, registerAuthStorageHandlers } = await import(
      '../../app/desktop/main/auth-storage'
    );
    registerAuthStorageHandlers();
    registerAuthStorageHandlers();
    expect(electronState.ipcMain.handle).toHaveBeenCalledTimes(4);

    fsState.readFile.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          refreshToken: 'refresh-token',
          rememberDevice: true,
          savedAt: '2024-01-01T00:00:00.000Z',
          sessionExpiresAt: '2099-01-01T00:00:00.000Z',
        }),
      ),
    );

    expect(electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.isAvailable)?.()).toBe(true);
    await expect(
      electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.get)?.(),
    ).resolves.toEqual({
      refreshToken: 'refresh-token',
      rememberDevice: true,
      savedAt: '2024-01-01T00:00:00.000Z',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    });

    await electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.set)?.(null, {
      refreshToken: 'refresh-token',
      rememberDevice: true,
      savedAt: '2024-01-01T00:00:00.000Z',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect(fsState.writeFile).toHaveBeenCalled();

    await electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.clear)?.();
    expect(fsState.rm).toHaveBeenCalledTimes(3);

    fsState.readFile.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    await expect(electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.get)?.()).resolves.toBeNull();

    fsState.readFile.mockRejectedValueOnce(new Error('corrupt'));
    await expect(electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.get)?.()).resolves.toBeNull();
    expect(fsState.rm).toHaveBeenCalled();

    electronState.safeStorage.isEncryptionAvailable.mockReturnValue(false);
    process.env.VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173';
    fsState.readFile.mockResolvedValueOnce(
      JSON.stringify({
        refreshToken: 'refresh-token',
        rememberDevice: true,
        savedAt: '2024-01-01T00:00:00.000Z',
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );
    await expect(electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.get)?.()).resolves.toEqual(
      expect.objectContaining({
        refreshToken: 'refresh-token',
      }),
    );
    await electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.set)?.(null, {
      refreshToken: 'refresh-token',
      rememberDevice: true,
      savedAt: '2024-01-01T00:00:00.000Z',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect(fsState.writeFile).toHaveBeenCalled();

    delete process.env.VITE_DEV_SERVER_URL;
    electronState.app.isPackaged = true;
    await expect(electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.get)?.()).resolves.toBeNull();
    await expect(
      electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.set)?.(null, {
        refreshToken: 'refresh-token',
        rememberDevice: true,
        savedAt: '2024-01-01T00:00:00.000Z',
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('Electron secure storage is unavailable on this system.');

    await expect(
      electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.set)?.(null, null),
    ).rejects.toThrow('Remembered auth session is malformed.');
    await expect(
      electronState.ipcHandlers.get(AUTH_STORAGE_CHANNELS.set)?.(null, {
        refreshToken: 'refresh-token',
      }),
    ).rejects.toThrow('Remembered auth session payload is invalid.');
  });

  it('creates and controls the main browser window plus ipc handlers', async () => {
    process.env.VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173';
    const { createMainWindow } = await import('../../app/desktop/main/create-main-window');
    const mainWindow = createMainWindow();

    expect(electronState.app.dock.setIcon).toHaveBeenCalled();
    expect(mainWindow.loadURL).toHaveBeenCalledWith('http://127.0.0.1:5173');
    mainWindow.readyToShowHandler?.();
    expect(mainWindow.show).toHaveBeenCalled();
    expect(
      mainWindow.windowOpenHandler?.({
        url: 'https://example.com',
      }),
    ).toEqual({
      action: 'deny',
    });
    expect(electronState.shell.openExternal).toHaveBeenCalledWith('https://example.com');

    const { bindWindowControlEvents, registerWindowControlHandlers } = await import(
      '../../app/desktop/main/window-controls'
    );
    bindWindowControlEvents(mainWindow);
    mainWindow.didFinishLoadHandler?.();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('desktop-window:state-changed', {
      height: 1020,
      isFullScreen: false,
      isMaximized: false,
      width: 1680,
    });

    registerWindowControlHandlers();
    registerWindowControlHandlers();
    expect(electronState.ipcMain.handle).toHaveBeenCalled();

    const senderEvent = {
      sender: {},
    };
    await electronState.ipcHandlers.get('desktop-window:minimize')?.(senderEvent);
    expect(mainWindow.isMinimized()).toBe(true);
    await electronState.ipcHandlers.get('desktop-window:minimize')?.(senderEvent);

    expect(
      electronState.ipcHandlers.get('desktop-window:toggle-maximize')?.(senderEvent),
    ).toEqual({
      height: 1020,
      isFullScreen: false,
      isMaximized: true,
      width: 1680,
    });
    expect(
      electronState.ipcHandlers.get('desktop-window:toggle-maximize')?.(senderEvent),
    ).toEqual({
      height: 1020,
      isFullScreen: false,
      isMaximized: false,
      width: 1680,
    });
    mainWindow.maximizable = false;
    expect(
      electronState.ipcHandlers.get('desktop-window:toggle-maximize')?.(senderEvent),
    ).toEqual({
      height: 1020,
      isFullScreen: false,
      isMaximized: false,
      width: 1680,
    });

    expect(
      electronState.ipcHandlers.get('desktop-window:set-fullscreen')?.(senderEvent, true),
    ).toEqual({
      height: 1020,
      isFullScreen: true,
      isMaximized: false,
      width: 1680,
    });
    mainWindow.fullscreenable = false;
    expect(
      electronState.ipcHandlers.get('desktop-window:set-fullscreen')?.(senderEvent, false),
    ).toEqual({
      height: 1020,
      isFullScreen: true,
      isMaximized: false,
      width: 1680,
    });
    mainWindow.fullscreenable = true;
    expect(
      electronState.ipcHandlers.get('desktop-window:set-resolution')?.(senderEvent, {
        height: 900,
        width: 1600,
      }),
    ).toEqual({
      height: 900,
      isFullScreen: true,
      isMaximized: false,
      width: 1600,
    });
    expect(mainWindow.setContentSize).toHaveBeenCalledWith(1600, 900);
    expect(mainWindow.center).toHaveBeenCalled();

    await electronState.ipcHandlers.get('desktop-window:close')?.(senderEvent);
    expect(mainWindow.destroy).toHaveBeenCalled();
    expect(electronState.app.exit).toHaveBeenCalledWith(0);
    expect(electronState.ipcHandlers.get('desktop-window:get-state')?.(senderEvent)).toEqual({
      height: 900,
      isFullScreen: true,
      isMaximized: false,
      width: 1600,
    });

    electronState.MockBrowserWindow.fromWebContents.mockReturnValueOnce(null);
    expect(() =>
      electronState.ipcHandlers.get('desktop-window:get-state')?.(senderEvent),
    ).toThrow('No BrowserWindow was found for the active renderer process.');

    delete process.env.VITE_DEV_SERVER_URL;
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: '/tmp/resources',
    });
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'linux',
    });
    vi.resetModules();
    const prodCreateMainWindow = (await import('../../app/desktop/main/create-main-window'))
      .createMainWindow;
    const prodWindow = prodCreateMainWindow();
    expect(prodWindow.loadFile).toHaveBeenCalledWith(expect.stringContaining('/dist/index.html'));
    expect(prodWindow.options.icon).toContain('/tmp/resources/icons/icon-desktop-game.png');
  });

  it('exposes the preload bridge and boots the electron main process', async () => {
    process.env.VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173';
    await import('../../app/desktop/preload/index');

    const exposedBridge = electronState.contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    expect(electronState.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'desktop',
      expect.any(Object),
    );
    await exposedBridge.authStorage.clearRememberedSession();
    await exposedBridge.authStorage.getRememberedSession();
    await exposedBridge.authStorage.isPersistentStorageAvailable();
    await exposedBridge.authStorage.setRememberedSession({
      refreshToken: 'refresh-token',
      rememberDevice: true,
      savedAt: '2024-01-01T00:00:00.000Z',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    await exposedBridge.windowControls.close();
    await exposedBridge.windowControls.getState();
    await exposedBridge.windowControls.minimize();
    const stateListener = vi.fn();
    const unsubscribe = exposedBridge.windowControls.onStateChange(stateListener);
    electronState.ipcRendererListeners
      .get('desktop-window:state-changed')
      ?.({} as never, { height: 900, isFullScreen: false, isMaximized: true, width: 1600 });
    expect(stateListener).toHaveBeenCalledWith({
      height: 900,
      isFullScreen: false,
      isMaximized: true,
      width: 1600,
    });
    unsubscribe();
    await exposedBridge.windowControls.setFullscreen(true);
    await exposedBridge.windowControls.setResolution(1600, 900);
    await exposedBridge.windowControls.toggleMaximize();
    expect(exposedBridge.environment).toBe('development');
    expect(exposedBridge.isPackaged).toBe(false);

    const createMainWindow = vi.fn();
    const registerAuthStorageHandlers = vi.fn();
    const registerWindowControlHandlers = vi.fn();
    vi.doMock('../../app/desktop/main/create-main-window', () => ({
      createMainWindow,
    }));
    vi.doMock('../../app/desktop/main/auth-storage', () => ({
      registerAuthStorageHandlers,
    }));
    vi.doMock('../../app/desktop/main/window-controls', () => ({
      registerWindowControlHandlers,
    }));

    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'linux',
    });
    await import('../../app/desktop/main/index');
    await Promise.resolve();

    expect(electronState.app.setName).toHaveBeenCalledWith('Dead As Battle');
    expect(registerAuthStorageHandlers).toHaveBeenCalled();
    expect(registerWindowControlHandlers).toHaveBeenCalled();
    expect(createMainWindow).toHaveBeenCalledTimes(1);

    electronState.MockBrowserWindow.allWindows = [];
    electronState.appHandlers.get('activate')?.();
    expect(createMainWindow).toHaveBeenCalledTimes(2);

    electronState.appHandlers.get('window-all-closed')?.();
    expect(electronState.app.quit).toHaveBeenCalled();

    vi.resetModules();
    electronState.app.quit.mockClear();
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'darwin',
    });
    await import('../../app/desktop/main/index');
    await Promise.resolve();
    electronState.appHandlers.get('window-all-closed')?.();
    expect(electronState.app.quit).not.toHaveBeenCalled();
  });
});
