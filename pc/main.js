const { app, BrowserWindow, ipcMain, dialog, shell, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Garde le même dossier de données qu'avant le changement de nom (%APPDATA%\Horaires)
app.setPath('userData', path.join(app.getPath('appData'), 'Horaires'));

const dataDir = () => app.getPath('userData');
const sid = (s) => (String(s || 'bredis').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bredis');
const dataFile = (s) => path.join(dataDir(), sid(s) === 'bredis' ? 'horaires-data.json' : 'horaires-data-' + sid(s) + '.json');

// Copie de sécurité automatique : une par jour, les 30 dernières sont gardées
function backup(json, s) {
  try {
    const d = path.join(dataDir(), 'sauvegardes');
    fs.mkdirSync(d, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(d, (sid(s) === 'bredis' ? 'horaires-' : 'horaires-' + sid(s) + '-') + day + '.json'), json);
    const pre = sid(s) === 'bredis' ? 'horaires-2' : 'horaires-' + sid(s) + '-';
    const files = fs.readdirSync(d).filter(f => f.startsWith(pre) && f.endsWith('.json')).sort();
    while (files.length > 30) fs.unlinkSync(path.join(d, files.shift()));
  } catch (e) {}
}

ipcMain.on('load', (e, s) => {
  try { e.returnValue = fs.existsSync(dataFile(s)) ? fs.readFileSync(dataFile(s), 'utf8') : null; }
  catch (err) { e.returnValue = null; }
});

ipcMain.on('save', (e, s, json) => {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    const tmp = dataFile(s) + '.tmp';
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, dataFile(s));
    backup(json, s);
  } catch (err) {}
});

ipcMain.handle('export', async (e, json, s) => {
  const r = await dialog.showSaveDialog({
    defaultPath: 'horaires-' + sid(s) + '-' + new Date().toISOString().slice(0, 10) + '.json',
    filters: [{ name: 'Sauvegarde Horaires', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, json);
  return true;
});

ipcMain.handle('import', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde Horaires', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

ipcMain.handle('openFolder', () => shell.openPath(dataDir()));

// Impression : ouvre la fenêtre d'impression de Windows (A4 paysage)
ipcMain.handle('print', (e) => new Promise((resolve) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return resolve(false);
  w.webContents.print({ silent: false, printBackground: false, landscape: true, pageSize: 'A4' }, (ok) => resolve(ok));
}));


// ===== Mise à jour sans réinstaller =====
// La page index.html téléchargée est rangée dans %APPDATA%\Horaires\app ; elle est utilisée
// seulement si sa version est plus récente que celle de l'installateur.
const appDir = () => path.join(dataDir(), 'app');
const verOf = (f) => { try { const m = /name="gt-version"\s+content="(\d+)"/.exec(fs.readFileSync(f, 'utf8').slice(0, 4000)); return m ? +m[1] : 0; } catch (e) { return 0; } };
function pickPage() {
  const b = path.join(__dirname, 'index.html'), u = path.join(appDir(), 'index.html');
  try {
    if (fs.existsSync(u) && verOf(u) > verOf(b)) {
      for (const f of ['config.js', 'icon.png']) fs.copyFileSync(path.join(__dirname, f), path.join(appDir(), f));
      return u;
    }
  } catch (e) {}
  return b;
}
const curVersion = () => verOf(pickPage());
const baseUrl = (u) => { u = String(u || ''); return /^(https:\/\/|http:\/\/127\.0\.0\.1)/.test(u) && !/VOTRE/i.test(u) ? (u.endsWith('/') ? u : u + '/') : null; };
async function getText(url) {
  const r = await net.fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
ipcMain.handle('update-info', () => ({ version: curVersion() }));
ipcMain.handle('update-check', async (e, u) => {
  const b = baseUrl(u); if (!b) return { status: 'noconfig', version: curVersion() };
  try { const v = JSON.parse(await getText(b + 'version.json')); const cur = curVersion();
    return { status: +v.version > cur ? 'new' : 'none', version: cur, remote: +v.version, note: v.note || '' };
  } catch (err) { return { status: 'error', version: curVersion(), msg: String(err.message || err) }; }
});
ipcMain.handle('update-apply', async (e, u) => {
  const b = baseUrl(u); if (!b) return { status: 'noconfig' };
  try {
    const v = JSON.parse(await getText(b + 'version.json')); const html = await getText(b + 'index.html');
    const mv = /name="gt-version"\s+content="(\d+)"/.exec(html.slice(0, 4000));
    if (!mv || +mv[1] !== +v.version || html.length < 100000 || !/<\/html>\s*$/i.test(html) || !html.includes('window.api'))
      return { status: 'error', msg: 'Fichier de mise à jour incomplet ou invalide (rien n’a été modifié).' };
    fs.mkdirSync(appDir(), { recursive: true });
    const f = path.join(appDir(), 'index.html');
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(appDir(), 'index.prev.html'));
    fs.writeFileSync(f + '.tmp', html); fs.renameSync(f + '.tmp', f);
    setTimeout(() => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.loadFile(pickPage()); }, 900);
    return { status: 'done', version: +v.version };
  } catch (err) { return { status: 'error', msg: String(err.message || err) }; }
});
ipcMain.handle('update-reset', (e) => {
  try { fs.rmSync(appDir(), { recursive: true, force: true }); } catch (err) {}
  setTimeout(() => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.loadFile(pickPage()); }, 300);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, title: 'GESTIME', icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  win.loadFile(pickPage());
  // Si la page mise à jour ne s'ouvre pas, retour automatique à celle de l'installateur
  win.webContents.on('did-fail-load', (ev, code, d, url, main) => { if (main && !url.endsWith('/resources/app.asar/index.html') && pickPage() !== path.join(__dirname, 'index.html')) { try { fs.rmSync(appDir(), { recursive: true, force: true }); } catch (e) {} win.loadFile(path.join(__dirname, 'index.html')); } });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
