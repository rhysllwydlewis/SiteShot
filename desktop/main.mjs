import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

if (process.platform === 'win32') {
  app.setAppUserModelId('uk.siteshot.auditorstudio');
}

let mainWindow;
let activeProcess = null;

const REPORT_FILES = {
  report: 'report.html',
  quick: 'quick-report.html',
  full: 'full-report.html',
  client: 'client-report.html',
  executive: 'executive-summary.html',
  technical: 'technical-report.html',
  roadmap: 'fix-roadmap.html',
  gallery: 'gallery.html',
  pdf: 'report.pdf',
  docx: 'report.docx',
  issuesCsv: 'issues.csv',
  issuesJson: 'issues.json',
  tickets: 'tickets.md',
  summaryPath: 'summary.json',
  manifest: 'manifest.json'
};

function storePath() {
  return path.join(app.getPath('userData'), 'siteshot-store.json');
}

const defaultStore = {
  runs: [],
  projects: [],
  templates: [],
  settings: {
    defaultOutputRoot: '',
    lastTarget: 'https://event-flow.co.uk',
    lastOutput: 'audit/eventflow-ultra'
  }
};

async function readStore() {
  try {
    const p = storePath();
    if (!fs.existsSync(p)) return structuredClone(defaultStore);
    return { ...structuredClone(defaultStore), ...JSON.parse(await fsp.readFile(p, 'utf8')) };
  } catch {
    return structuredClone(defaultStore);
  }
}

async function writeStore(store) {
  await fsp.mkdir(path.dirname(storePath()), { recursive: true });
  await fsp.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf8');
  return store;
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1030,
    minWidth: 1280,
    minHeight: 820,
    title: 'SiteShot Auditor Studio Ultra',
    backgroundColor: '#07111c',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}
