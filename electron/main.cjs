const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const origin = 'aircontrol://game';
const assets = path.join(__dirname, '..', 'dist-desktop');
protocol.registerSchemesAsPrivileged([
  { scheme: 'aircontrol', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// Snap revisions must share the same persistent career data.
if (process.env.SNAP_USER_COMMON) {
  app.setPath('userData', path.join(process.env.SNAP_USER_COMMON, 'air-traffic-control'));
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Air Traffic Control',
    width: 1280,
    height: 850,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: '#254039',
    icon: path.join(__dirname, '..', 'build', 'icons', '512x512.png'),
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://apps.microsoft.com/detail/9N5536ZQ2XZM' || url === 'https://snapcraft.io/air-traffic-control' || url === 'https://www.supportkori.com/montasim') {
      shell.openExternal(url).catch(error => console.error('Unable to open external link:', error));
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== `${origin}/` && url !== `${origin}/index.html`) event.preventDefault();
  });
  window.loadURL(`${origin}/`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    protocol.handle('aircontrol', (request) => {
      const url = new URL(request.url);
      if (url.hostname !== 'game' || request.method !== 'GET') return new Response(null, { status: 403 });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return new Response(null, { status: 400 }); }
      const file = path.resolve(assets, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(`${assets}${path.sep}`)) return new Response(null, { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    });
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => app.quit());
}
