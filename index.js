import express from "express";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";
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

// Get all local IPv4 addresses for SAN
function getLocalIPs() {
  const ips = new Set(["127.0.0.1"]);
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        ips.add(addr.address);
      }
    }
  }
  return [...ips];
}

// Generate self-signed cert with SAN including all local IPs
function ensureCerts() {
  const keyPath = path.join(CERTS_DIR, "key.pem");
  const certPath = path.join(CERTS_DIR, "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  console.log("Generating self-signed certificate...");
  fs.mkdirSync(CERTS_DIR, { recursive: true });

  const ips = getLocalIPs();
  const altNames = [
    { type: 2, value: "localhost" },
    ...ips.map((ip) => ({ type: 7, ip })),
  ];

  console.log("Certificate SANs:", ["localhost", ...ips].join(", "));

  const pems = selfsigned.generate(
    [{ name: "commonName", value: "playwright-reports" }],
    {
      days: 365,
      keySize: 2048,
      extensions: [{ name: "subjectAltName", altNames }],
    },
  );

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log("Certificate generated at certs/");
  console.log("");
  console.log("=== INSTALL CERTIFICATE (one-time, run as Administrator) ===");
  console.log(`  certutil -addstore Root "${path.resolve(certPath)}"`);
  console.log("=============================================================");
  console.log("");

  return { key: pems.private, cert: pems.cert };
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
  console.warn(`HTTPS not available: ${err.message}`);
  console.warn("Trace viewer will only work on http://localhost");
}
