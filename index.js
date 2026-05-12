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

// Serve certificate for easy install from any machine
app.get("/cert", (req, res) => {
  const certPath = path.join(CERTS_DIR, "cert.pem");
  if (!fs.existsSync(certPath)) return res.status(404).send("No certificate generated yet.");
  res.setHeader("Content-Type", "application/x-pem-file");
  res.setHeader("Content-Disposition", "attachment; filename=playwright-reports.pem");
  fs.createReadStream(certPath).pipe(res);
});

app.get("/install", (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const httpHost = host.replace(`:${HTTPS_PORT}`, `:${PORT}`);
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html><html><head><title>Install Certificate</title>
<style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px}
code{background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:14px}
.cmd-block{position:relative}
pre{background:#1e1e1e;color:#d4d4d4;padding:16px;padding-right:50px;border-radius:8px;overflow-x:auto}
.copy-btn{position:absolute;top:8px;right:8px;background:#444;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px}
.copy-btn:hover{background:#666}
.copy-btn.copied{background:#2ea043}
.step{margin:24px 0}.note{color:#666;font-size:14px}</style></head>
<body><h1>Install Certificate</h1>
<p>Run this <b>one command</b> in PowerShell <b>as Administrator</b> to trust the dashboard certificate:</p>
<div class="cmd-block"><pre id="cmd">Invoke-WebRequest -Uri "http://${httpHost}/cert" -OutFile "$env:TEMP\\pw-reports.pem"; certutil -addstore Root "$env:TEMP\\pw-reports.pem"; Remove-Item "$env:TEMP\\pw-reports.pem"</pre><button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent).then(()=>{this.textContent='Copied!';this.classList.add('copied');setTimeout(()=>{this.textContent='Copy';this.classList.remove('copied')},2000)})">Copy</button></div>
<p class="note">This downloads the certificate, installs it in Trusted Root, and cleans up. One-time only.</p>
<div class="step"><h3>Then restart your browser and access:</h3>
<p><a href="https://${host.replace(`:${PORT}`, `:${HTTPS_PORT}`)}">https://${host.replace(`:${PORT}`, `:${HTTPS_PORT}`)}</a></p></div>
<div class="step"><h3>Or download manually:</h3>
<p><a href="/cert">Download cert.pem</a> → then run: <code>certutil -addstore Root cert.pem</code></p></div>
</body></html>`);
});

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
