const { app, BrowserWindow, Menu, dialog, nativeTheme, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const APP_ID = 'com.hakosworld.melo';
const WINDOW_BACKGROUND = '#0a0a0b';

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let serverOrigin = null;

const isDev = !app.isPackaged;

/** The engine is a plain Node script, bundled by esbuild at build time. */
function engineEntry() {
  return isDev
    ? path.join(__dirname, 'engine', 'server.cjs')
    : path.join(process.resourcesPath, 'engine', 'server.cjs');
}

function rendererDirectory() {
  return isDev ? path.join(__dirname, 'dist-renderer') : path.join(process.resourcesPath, 'renderer');
}

function portFilePath() {
  return path.join(app.getPath('userData'), 'port.json');
}

function readSavedPort() {
  try {
    const saved = JSON.parse(fs.readFileSync(portFilePath(), 'utf8'));
    return Number(saved.port) || null;
  } catch {
    return null;
  }
}

function savePort(port) {
  try {
    fs.mkdirSync(path.dirname(portFilePath()), { recursive: true });
    fs.writeFileSync(portFilePath(), JSON.stringify({ port }));
  } catch {
    /* A fixed port is a convenience; a fresh one still works. */
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Could not reserve a local port.')));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Keep the same origin between launches. Playlists, downloads and settings live
 * in origin-scoped storage, so a random port each run would hand the user an
 * empty app every time.
 */
async function resolveStablePort() {
  const saved = readSavedPort();
  if (saved && (await isPortFree(saved))) return saved;
  const port = await findFreePort();
  savePort(port);
  return port;
}

function startServer(port) {
  const entry = engineEntry();
  if (!fs.existsSync(entry)) {
    throw new Error(`The melo engine is missing at ${entry}. Run npm run build first.`);
  }
  serverProcess = spawn(process.execPath, [entry], {
    // The engine resolves bundled tools (bin/yt-dlp) relative to its cwd.
    cwd: isDev ? __dirname : process.resourcesPath,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      MELO_RENDERER_DIR: rendererDirectory(),
      // The installed app's version, so Settings reports what is actually running.
      MELO_APP_VERSION: app.getVersion(),
    },
  });

  serverProcess.stdout?.on('data', (chunk) => process.stdout.write(`[melo] ${chunk}`));
  serverProcess.stderr?.on('data', (chunk) => process.stderr.write(`[melo] ${chunk}`));
  serverProcess.on('exit', (code) => {
    if (mainWindow && !mainWindow.isDestroyed() && code !== 0) {
      dialog.showErrorBox('melo stopped', `The local music engine exited with code ${code}.`);
    }
  });
}

async function waitForServer(origin, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`The local music engine exited with code ${serverProcess.exitCode}.`);
    }
    try {
      const response = await fetch(origin, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      /* server not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('The local music engine did not start in time.');
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url) && !url.startsWith(serverOrigin ?? '\u0000')) {
    void shell.openExternal(url);
    return true;
  }
  return false;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    show: false,
    backgroundColor: WINDOW_BACKGROUND,
    autoHideMenuBar: true,
    title: 'melo',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (openExternal(url)) event.preventDefault();
  });

  // Keep reload/devtools reachable without a menu bar.
  window.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    if (input.type !== 'keyDown') return;
    if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      window.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.control && key === 'r') {
      window.webContents.reload();
      event.preventDefault();
    }
  });

  void window.loadURL(process.env.MELO_DEV_URL || serverOrigin || 'about:blank');
  return window;
}

async function boot() {
  nativeTheme.themeSource = 'dark';
  const port = isDev
    ? Number(process.env.MELO_ENGINE_PORT || 3210)
    : await resolveStablePort();
  serverOrigin = `http://127.0.0.1:${port}`;
  startServer(port);
  await waitForServer(serverOrigin);
  mainWindow = createWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  Menu.setApplicationMenu(null);

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(boot).catch((error) => {
    dialog.showErrorBox('melo could not start', String(error?.message ?? error));
    app.quit();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
    }
  });
}
