import { app, BrowserWindow, dialog, net, protocol, session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAsset } from './assets.mjs';

protocol.registerSchemesAsPrivileged([
  { scheme: 'atc', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

await app.whenReady();
session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
protocol.handle('atc', async (request) => {
  try {
    const file = resolveAsset(join(app.getAppPath(), 'dist'), request.url);
    if (!file) return new Response('Forbidden', { status: 403 });
    return await net.fetch(pathToFileURL(file).href);
  } catch {
    return new Response('Not found', { status: 404 });
  }
});

function createWindow() {
  const window = new BrowserWindow({
    title: 'Air Traffic Control',
    width: 1280,
    height: 900,
    minWidth: 480,
    minHeight: 640,
    backgroundColor: '#254039',
    icon: join(app.getAppPath(), 'desktop', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const destination = new URL(url);
    if (destination.protocol !== 'atc:' || destination.host !== 'game') event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.loadURL('atc://game/').catch((error) => dialog.showErrorBox('Unable to open Air Traffic Control', error.message));
}

createWindow();
app.on('window-all-closed', () => app.quit());
