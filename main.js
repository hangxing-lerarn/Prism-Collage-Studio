const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

function resolvePortableDataDir() {
  // 若作为打包后的绿色便携版 .exe 运行，优先在 .exe 同级创建 data 目录以便随文件夹便携保存
  const exeDir = path.dirname(process.execPath);
  const isPortableLayout = !process.execPath.toLowerCase().includes('node_modules');
  const preferredDir = isPortableLayout ? path.join(exeDir, 'data') : path.join(__dirname, 'data');
  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
    return preferredDir;
  } catch (e) {
    const fallback = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

let DATA_DIR = path.join(__dirname, 'data');
let CUSTOM_TPL_FILE = path.join(DATA_DIR, 'custom-templates.json');
let CUSTOM_STICKER_FILE = path.join(DATA_DIR, 'custom-stickers.json');
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.avif', '.svg']);

function ensureDataDir() {
  DATA_DIR = resolvePortableDataDir();
  CUSTOM_TPL_FILE = path.join(DATA_DIR, 'custom-templates.json');
  CUSTOM_STICKER_FILE = path.join(DATA_DIR, 'custom-stickers.json');
}

function getMimeType(ext) {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.bmp': return 'image/bmp';
    case '.gif': return 'image/gif';
    case '.avif': return 'image/avif';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

function readFileAsImagePayload(filePath) {
  const ext = path.extname(filePath);
  if (!IMAGE_EXTS.has(ext.toLowerCase())) return null;
  const buf = fs.readFileSync(filePath);
  const mime = getMimeType(ext);
  return {
    name: path.basename(filePath),
    path: filePath,
    size: buf.length,
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`
  };
}

let mainWindow = null;

function createWindow() {
  ensureDataDir();
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 930,
    minWidth: 1160,
    minHeight: 720,
    title: 'Prism Collage Studio · 异形与分镜拼图工作台',
    backgroundColor: '#14161c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 1. 选择多张本地图片
ipcMain.handle('dialog:openImages', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择要导入的图片（可按住 Ctrl / Shift 多选）',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'avif'] }
    ]
  });
  if (res.canceled || !res.filePaths.length) return [];
  const items = [];
  for (const fp of res.filePaths) {
    try {
      const payload = readFileAsImagePayload(fp);
      if (payload) items.push(payload);
    } catch (e) {
      console.error('Failed reading image:', fp, e);
    }
  }
  return items;
});

// 2. 选择整个文件夹扫描图片
ipcMain.handle('dialog:openFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择包含图片的本地文件夹',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths.length) return [];
  const folder = res.filePaths[0];
  const items = [];
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTS.has(ext)) {
          const fullPath = path.join(folder, entry.name);
          const payload = readFileAsImagePayload(fullPath);
          if (payload) items.push(payload);
        }
      }
    }
  } catch (e) {
    console.error('Failed reading directory:', folder, e);
  }
  return items;
});

// 3. 拖拽文件夹或文件路径解析
ipcMain.handle('fs:readDroppedPaths', async (_event, paths) => {
  const items = [];
  if (!Array.isArray(paths)) return items;
  for (const p of paths) {
    try {
      if (!p || !fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(p, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
            const payload = readFileAsImagePayload(path.join(p, entry.name));
            if (payload) items.push(payload);
          }
        }
      } else if (stat.isFile()) {
        const payload = readFileAsImagePayload(p);
        if (payload) items.push(payload);
      }
    } catch (e) {
      console.error('Error reading dropped path:', p, e);
    }
  }
  return items;
});

// 4. 获取 Windows 本机已安装字体列表
let cachedFonts = null;
ipcMain.handle('system:getFonts', async () => {
  if (cachedFonts) return cachedFonts;
  const fallbackFonts = [
    'Microsoft YaHei UI', 'Microsoft YaHei', 'SimHei', 'SimSun', 'KaiTi', 'FangSong',
    'YouYuan', 'STXihei', 'STKaiti', 'STSong', 'DengXian',
    'Segoe UI', 'Arial', 'Impact', 'Georgia', 'Times New Roman', 'Verdana', 'Consolas'
  ];
  return new Promise((resolve) => {
    const psCmd = 'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }';
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { timeout: 6000 }, (err, stdout) => {
      if (err || !stdout) {
        cachedFonts = fallbackFonts;
        return resolve(cachedFonts);
      }
      const list = stdout
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...fallbackFonts, ...list]));
      cachedFonts = merged;
      resolve(cachedFonts);
    });
  });
});

// 5. 高清导出拼图成品图片
ipcMain.handle('export:saveImage', async (_event, { dataUrl, defaultName, format }) => {
  const ext = format === 'jpeg' ? 'jpg' : format;
  const filters = [
    format === 'png'
      ? { name: 'PNG 无损透明图片 (*.png)', extensions: ['png'] }
      : format === 'webp'
        ? { name: 'WebP 高清透明图片 (*.webp)', extensions: ['webp'] }
        : { name: 'JPEG 图片 (*.jpg)', extensions: ['jpg', 'jpeg'] }
  ];
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出拼图成品',
    defaultPath: defaultName || `拼图成品_${Date.now()}.${ext}`,
    filters
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(res.filePath, Buffer.from(base64Data, 'base64'));
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('shell:showItem', async (_event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

// 6. 自定义模板库持久化与导入导出
ipcMain.handle('templates:loadCustom', async () => {
  ensureDataDir();
  if (!fs.existsSync(CUSTOM_TPL_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_TPL_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
});

ipcMain.handle('templates:saveCustom', async (_event, templates) => {
  ensureDataDir();
  fs.writeFileSync(CUSTOM_TPL_FILE, JSON.stringify(templates, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('templates:exportFile', async (_event, { templateData, name }) => {
  const safeName = (name || '自定义模板').replace(/[\\/:*?"<>|]/g, '_');
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出拼图模板文件',
    defaultPath: `${safeName}.collage-tpl.json`,
    filters: [{ name: '拼图布局模板 (*.collage-tpl.json)', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(templateData, null, 2), 'utf-8');
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('templates:importFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '导入拼图模板文件',
    properties: ['openFile'],
    filters: [{ name: '拼图布局模板 (*.json)', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  try {
    const content = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf-8'));
    return { canceled: false, data: content };
  } catch (e) {
    return { canceled: false, error: '模板文件格式无效或已损坏' };
  }
});

// 7. 自定义装饰贴纸库持久化与选取上传
ipcMain.handle('stickers:loadCustom', async () => {
  ensureDataDir();
  if (!fs.existsSync(CUSTOM_STICKER_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_STICKER_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
});

ipcMain.handle('stickers:saveCustom', async (_event, list) => {
  ensureDataDir();
  fs.writeFileSync(CUSTOM_STICKER_FILE, JSON.stringify(list, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('dialog:openStickerImages', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择自定义装饰图片（支持透明 PNG/WebP/SVG，或白底/黑底图一键抠除背景）',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '装饰图片', extensions: ['png', 'webp', 'svg', 'jpg', 'jpeg', 'gif', 'bmp'] }
    ]
  });
  if (res.canceled || !res.filePaths.length) return [];
  const items = [];
  for (const fp of res.filePaths) {
    try {
      const payload = readFileAsImagePayload(fp);
      if (payload) items.push(payload);
    } catch (e) {}
  }
  return items;
});

// 8. 完整拼图工程文件保存与打开
ipcMain.handle('project:save', async (_event, { projectJson, defaultName }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '保存完整拼图工程（保留原图与编辑进度）',
    defaultPath: defaultName || `拼图工程_${Date.now()}.collage-proj.json`,
    filters: [{ name: '拼图工程文件 (*.collage-proj.json)', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  fs.writeFileSync(res.filePath, projectJson, 'utf-8');
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '打开完整拼图工程文件',
    properties: ['openFile'],
    filters: [{ name: '拼图工程文件 (*.json)', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  try {
    const raw = fs.readFileSync(res.filePaths[0], 'utf-8');
    return { canceled: false, data: JSON.parse(raw), filePath: res.filePaths[0] };
  } catch (e) {
    return { canceled: false, error: '工程文件无法解析或已损坏' };
  }
});
