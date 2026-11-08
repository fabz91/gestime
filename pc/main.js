const { app, BrowserWindow, ipcMain, dialog, shell, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs');

// 1.2.0 (08/11/2026) : comme GESMAR et GESCOUNT, tout est dans %APPDATA%\GESTIME et les données dans %APPDATA%\GESTIME\donnees
// (fichiers gestime-bredis.json, gestime-clamart.json, dossier sauvegardes). Au premier lancement, l'ancien dossier
// %APPDATA%\Horaires est recopié (connexion G20, réglages et données gardés), vérifié, puis supprimé.
const OLD_DIR = path.join(app.getPath('appData'), 'Horaires');
const NEW_DIR = path.join(app.getPath('appData'), 'GESTIME');
const DATA_DIR = path.join(NEW_DIR, 'donnees');
function migrate() {
  try {
    if (!fs.existsSync(OLD_DIR)) return;
    if (!fs.existsSync(NEW_DIR)) fs.cpSync(OLD_DIR, NEW_DIR, { recursive: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let ok = true;
    for (const f of fs.readdirSync(NEW_DIR)) {
      const m = /^horaires-data(?:-([a-z0-9]+))?\.json$/i.exec(f);
      if (!m) continue;
      const to = path.join(DATA_DIR, 'gestime-' + (m[1] || 'bredis').toLowerCase() + '.json');
      if (!fs.existsSync(to)) fs.copyFileSync(path.join(NEW_DIR, f), to);
      if (fs.statSync(to).size !== fs.statSync(path.join(NEW_DIR, f)).size) { ok = false; continue; }
      fs.unlinkSync(path.join(NEW_DIR, f));
    }
    const ob = path.join(NEW_DIR, 'sauvegardes'), nb = path.join(DATA_DIR, 'sauvegardes');
    if (fs.existsSync(ob)) { if (!fs.existsSync(nb)) fs.renameSync(ob, nb); else fs.rmSync(ob, { recursive: true, force: true }); }
    // L'ancien dossier n'est supprimé que si les données sont bien dans le nouveau.
    if (ok && fs.existsSync(path.join(DATA_DIR, 'gestime-bredis.json'))) fs.rmSync(OLD_DIR, { recursive: true, force: true });
  } catch (e) {}
}
migrate();
app.setPath('userData', NEW_DIR);

const dataDir = () => DATA_DIR;
const sid = (s) => (String(s || 'bredis').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bredis');
const dataFile = (s) => path.join(dataDir(), 'gestime-' + sid(s) + '.json');

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
    // (v59 : plus de copie par magasin, voir la sauvegarde automatique commune plus bas)
  } catch (err) {}
});


// ===== Sauvegarde automatique (règle GES du 08/11/2026) =====
// Une fois par jour : UN fichier avec TOUS les magasins, au format de l'export (réimportable par Réglages → Importer).
// Rangé dans le dossier « sauvegardes » des données ; on garde les 60 derniers jours. Les anciennes copies par magasin sont retirées.
function autoBackupWrite(dir, appName, text) {
  const t = String(text || '');
  JSON.parse(t); if (t.length < 50) throw new Error('sauvegarde vide');
  const d = path.join(dir, 'sauvegardes'); fs.mkdirSync(d, { recursive: true });
  const n = new Date(), day = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  const f = path.join(d, appName + '-' + day + '.json');
  fs.writeFileSync(f + '.tmp', t, 'utf8'); fs.renameSync(f + '.tmp', f);
  const re = new RegExp('^' + appName + '-\\d{4}-\\d{2}-\\d{2}\\.json$');
  const all = fs.readdirSync(d);
  for (const x of all) if (/\.json$/i.test(x) && !re.test(x)) { try { fs.unlinkSync(path.join(d, x)); } catch (e) {} }
  const mine = all.filter(x => re.test(x)).sort();
  while (mine.length > 60) { try { fs.unlinkSync(path.join(d, mine.shift())); } catch (e) {} }
  return f;
}
ipcMain.handle('autobackup', (e, text) => { try { return autoBackupWrite(dataDir(), 'GESTIME', text); } catch (err) { return false; } });

ipcMain.handle('export', async (e, json, s) => {
  const r = await dialog.showSaveDialog({
    defaultPath: 'horaires-' + sid(s) + '-' + new Date().toISOString().slice(0, 10) + '.json',
    filters: [{ name: 'Sauvegarde GESTIME', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, json);
  return true;
});

ipcMain.handle('import', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde GESTIME', extensions: ['json'] }]
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
// La page index.html téléchargée est rangée dans %APPDATA%\GESTIME\app ; elle est utilisée
// seulement si sa version est plus récente que celle de l'installateur.
const appDir = () => path.join(NEW_DIR, 'app');
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
