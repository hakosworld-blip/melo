const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const CHECK_DELAY_MS = 1500;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function readIgnored(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).version || ''; } catch (e) { return ''; }
}

function writeIgnored(file, version) {
  try { fs.writeFileSync(file, JSON.stringify({ version })); } catch (e) {}
}

/** Compare dotted versions numerically so `1.10.0` beats `1.9.9`. */
function isNewer(latest, current) {
  const p1 = String(latest || '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(current || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

/** Newest published release that ships an APK, falling back to any release. */
async function fetchRelevantRelease(repo) {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=30`;
  const res = await fetch(url, { headers: { 'User-Agent': 'melo-Player' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const releases = Array.isArray(json) ? json : [];
  const relevant = releases.filter(r => r.draft !== true && r.prerelease !== true);
  const withApk = relevant.filter(r => r.assets.some(a => /\.apk$/i.test(a.name)));
  const sorted = (arr) => arr.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const newest = sorted(withApk)[0] || sorted(relevant)[0] || null;
  return newest;
}

function initUpdater(getWindow) {
  const ignoreFile = path.join(app.getPath('userData'), 'ignored-update.json');
  const pkg = require('../../package.json');
  if (pkg.version) {
    app.setVersion(pkg.version);
  }
  const repo = 'hakosworld-blip/melo';
  let manualCheck = false;
  let installNow = false;
  let current = null;

  try { ipcMain.removeHandler('get-app-version'); } catch (_) {}
  ipcMain.handle('get-app-version', () => app.getVersion());

  const isDev = !app.isPackaged;
  const devConfigFile = path.join(__dirname, '../../dev-app-update.yml');
  const canInstall = !isDev && (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE));

  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const fallbackFetchGitHub = async () => {
    try {
      const release = await fetchRelevantRelease(repo);
      if (!release) return;
      const latestVersion = (release.tag_name || '').replace(/^v/i, '');
      const currentVersion = pkg.version || app.getVersion();
      if (isNewer(latestVersion, currentVersion)) {
        current = { version: latestVersion };
        const ignored = readIgnored(ignoreFile) === latestVersion;
        if (ignored && !manualCheck) return;
        manualCheck = false;
        send('update-available', {
          version: latestVersion,
          releaseNotes: release.body,
          htmlUrl: release.html_url,
          canInstall: false,
          url: release.html_url || `${release.html_url}/tag/v${latestVersion}`
        });
      } else {
        if (manualCheck) {
          send('update-not-available', { version: currentVersion });
        }
        manualCheck = false;
      }
    } catch (err) {
      if (manualCheck) {
        send('update-error', { message: err && err.message ? err.message : 'Update failed' });
      }
      manualCheck = false;
    }
  };

  let autoUpdater = null;
  const hasUpdaterSupport = !isDev || fs.existsSync(devConfigFile);
  if (hasUpdaterSupport && canInstall) {
    try {
      const eu = require('electron-updater');
      autoUpdater = eu.autoUpdater;
      if (isDev) autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;

      autoUpdater.on('update-available', (info) => {
        send('update-available', {
          version: info.version,
          releaseNotes: info.releaseNotes,
          htmlUrl: info.releaseName,
          canInstall: true,
          url: info.releaseName
        });
      });

      autoUpdater.on('update-not-available', () => {
        send('update-not-available', { version: app.getVersion() });
      });

      autoUpdater.on('download-progress', (p) => {
        send('update-progress', { percent: Math.round(p.percent) });
      });

      autoUpdater.on('update-downloaded', () => {
        if (installNow) autoUpdater.quitAndInstall();
      });

      autoUpdater.on('error', () => {
        send('update-error', { message: 'Update check failed' });
      });

    } catch (err) {
      // Fall back to the manual fetch when the built-in updater cannot start.
    }
  }

  const check = () => {
    if (!autoUpdater || !canInstall || isDev) {
      return fallbackFetchGitHub();
    }
    return autoUpdater.checkForUpdates().catch(() => {
      return fallbackFetchGitHub();
    });
  };

  return { check };
};

// main.js calls require('./updater').initUpdater(...); without these exports the call
// threw "initUpdater is not a function" as an unhandled rejection and the desktop
// auto-updater never ran.
module.exports = { initUpdater };
