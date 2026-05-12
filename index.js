import express from "express";
import https from "node:https";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { proxyRouter } from "./service/src/proxy.js";
import { apiRouter } from "./service/src/api.js";
import { getLocalDir } from "./service/src/gcs.js";
import { startSync } from "./sync/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 8080;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const DASHBOARD_DIR = path.join(__dirname, "dashboard", "dist");
const CERTS_DIR = path.join(__dirname, "certs");

// API + file proxy
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", apiRouter);
app.use("/files", proxyRouter);

// Dashboard SPA
if (fs.existsSync(path.join(DASHBOARD_DIR, "index.html"))) {
  app.use(express.static(DASHBOARD_DIR));
  app.get("/*splat", (req, res) => {
    res.sendFile(path.join(DASHBOARD_DIR, "index.html"));
  });
} else {
  console.warn("Dashboard not built. Run: npm run build:dashboard");
}

// Generate self-signed cert if it doesn't exist
function ensureCerts() {
  const keyPath = path.join(CERTS_DIR, "key.pem");
  const certPath = path.join(CERTS_DIR, "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  console.log("Generating self-signed certificate...");
  fs.mkdirSync(CERTS_DIR, { recursive: true });

  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=playwright-reports"`,
    { stdio: "pipe" },
  );

  console.log("Certificate generated at certs/");
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

// Start sync + servers
startSync();

// HTTP
app.listen(PORT, () => {
  console.log(`HTTP  → http://localhost:${PORT} [LOCAL: ${getLocalDir()}]`);
});

// HTTPS (required for trace viewer via non-localhost)
try {
  const certs = ensureCerts();
  https.createServer(certs, app).listen(HTTPS_PORT, () => {
    console.log(`HTTPS → https://localhost:${HTTPS_PORT} (use this for trace viewer)`);
  });
} catch (err) {
  console.warn(`HTTPS not available (openssl not found): ${err.message}`);
  console.warn("Trace viewer will only work on http://localhost");
}
