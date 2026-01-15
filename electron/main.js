const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const next = require("next");
const dotenv = require("dotenv");

const isDev = !app.isPackaged;

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = isDev ? "development" : "production";
}

let mainWindow;
let server;

function attachProcessLogging() {
  const logPath = getLogPath();
  const stream = fs.createWriteStream(logPath, { flags: "a" });

  const writeWithLog = (chunk, encoding, callback, originalWrite) => {
    try {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
      stream.write(text);
    } catch {
      // Ignore logging failures.
    }
    return originalWrite(chunk, encoding, callback);
  };

  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, encoding, callback) => writeWithLog(chunk, encoding, callback, stdoutWrite);
  process.stderr.write = (chunk, encoding, callback) => writeWithLog(chunk, encoding, callback, stderrWrite);
}

function getLogDir() {
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function getLogPath() {
  return path.join(getLogDir(), "main.log");
}

function ensureLogFile() {
  const logPath = getLogPath();
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "", "utf8");
  }
  return logPath;
}

function logLine(message) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(getLogPath(), `[${timestamp}] ${message}\n`, "utf8");
  } catch {
    // Ignore logging failures.
  }
}

function openPathWithError(targetPath, label) {
  shell.openPath(targetPath).then((error) => {
    if (error) {
      logLine(`Failed to open ${label}: ${error}`);
      dialog.showErrorBox("AssetSpace AI", `Failed to open ${label}.`);
    }
  });
}

function buildAppMenu() {
  const menu = Menu.buildFromTemplate([
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Open Logs Folder",
          click: () => openPathWithError(getLogDir(), "logs folder"),
        },
        {
          label: "Open Main Log",
          click: () => openPathWithError(ensureLogFile(), "main.log"),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

process.on("uncaughtException", (error) => {
  logLine(`uncaughtException: ${error?.stack || error}`);
});

process.on("unhandledRejection", (reason) => {
  logLine(`unhandledRejection: ${reason?.stack || reason}`);
});

function buildEnvTemplate() {
  return [
    "DATABASE_URL=",
    "NEXTAUTH_SECRET=",
    "NEXTAUTH_URL=",
    "AI_API_KEY=",
    "SEED_ADMIN_EMAIL=",
    "SEED_ADMIN_PASSWORD=",
    "SEED_WORKSPACE_NAME=",
    "",
  ].join("\n");
}

function ensureUserEnvTemplate() {
  if (!app.isPackaged) return null;
  const envPath = path.join(app.getPath("userData"), ".env");
  if (fs.existsSync(envPath)) return envPath;

  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  try {
    fs.writeFileSync(envPath, buildEnvTemplate(), { encoding: "utf8", flag: "wx" });
  } catch {
    // Ignore race conditions if another process created it.
  }
  return envPath;
}

function loadEnvFile() {
  const candidates = [];
  if (process.env.ASSETSPACE_ENV_PATH) {
    candidates.push(process.env.ASSETSPACE_ENV_PATH);
  }
  const userEnvPath = ensureUserEnvTemplate();
  if (userEnvPath) {
    candidates.push(userEnvPath);
  } else if (app.isPackaged) {
    candidates.push(path.join(app.getPath("userData"), ".env"));
  }
  candidates.push(path.join(__dirname, "..", ".env"));

  for (const envPath of candidates) {
    if (!envPath) continue;
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      logLine(`Loaded env file: ${envPath}`);
      return envPath;
    }
  }
  logLine("No env file found.");
  return null;
}

function ensureRequiredEnv() {
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (!missing.length) return;

  const message = `Missing required settings: ${missing.join(", ")}.\n\nCreate a .env file at:\n${app.getPath(
    "userData",
  )}\\\.env\n\nA template file was created there if it did not exist.\n\nOr set ASSETSPACE_ENV_PATH to point to your config file.`;
  dialog.showErrorBox("AssetSpace AI configuration missing", message);
  logLine(`Missing required env vars: ${missing.join(", ")}`);
  throw new Error(message);
}

function setPrismaEnginePath() {
  if (!app.isPackaged) return;
  const prismaDir = path.join(process.resourcesPath, "node_modules", ".prisma", "client");
  if (!fs.existsSync(prismaDir)) return;

  const engine = fs
    .readdirSync(prismaDir)
    .find((entry) => entry.startsWith("query_engine") && entry.endsWith(".node"));
  if (engine) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(prismaDir, engine);
    logLine(`Set PRISMA_QUERY_ENGINE_LIBRARY to ${process.env.PRISMA_QUERY_ENGINE_LIBRARY}`);
  }
}

function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

async function findAvailablePort(preferredPort, host) {
  if (Number.isFinite(preferredPort) && preferredPort > 0) {
    const available = await isPortAvailable(preferredPort, host);
    if (available) return preferredPort;
  }

  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", reject);
    tester.listen(0, host, () => {
      const address = tester.address();
      if (!address || typeof address === "string") {
        tester.close(() => reject(new Error("Unable to pick a port.")));
        return;
      }
      const picked = address.port;
      tester.close(() => resolve(picked));
    });
  });
}

async function startNextServer() {
  attachProcessLogging();
  loadEnvFile();

  const host = "127.0.0.1";
  const preferredPort = Number(process.env.ELECTRON_PORT || process.env.PORT || 3000);
  const port = await findAvailablePort(preferredPort, host);
  const baseUrl = `http://${host}:${port}`;
  process.env.PORT = String(port);
  process.env.NEXTAUTH_URL = baseUrl;
  logLine(`Starting Next server on ${baseUrl}`);
  ensureRequiredEnv();
  setPrismaEnginePath();

  const appDir = path.join(__dirname, "..");
  const nextApp = next({ dev: isDev, dir: appDir });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const httpServer = http.createServer(async (req, res) => {
    res.on("finish", () => {
      if (res.statusCode >= 500) {
        logLine(`Response ${res.statusCode} ${req.method} ${req.url}`);
      }
    });
    try {
      await handle(req, res);
    } catch (error) {
      logLine(`Request error ${req.method} ${req.url}: ${error?.stack || error}`);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  });
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => resolve());
  });

  return { httpServer, port, host };
}

async function createWindow() {
  const { httpServer, port, host } = await startNextServer();
  server = httpServer;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://${host}:${port}`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  if (process.env.ELECTRON_DEBUG === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  buildAppMenu();
  createWindow();
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
