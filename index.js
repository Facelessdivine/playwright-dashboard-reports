import express from "express";
import https from "node:https";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
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

// Generate self-signed cert using Node.js crypto (no openssl needed)
function ensureCerts() {
  const keyPath = path.join(CERTS_DIR, "key.pem");
  const certPath = path.join(CERTS_DIR, "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  console.log("Generating self-signed certificate...");
  fs.mkdirSync(CERTS_DIR, { recursive: true });

  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const cert = crypto.X509Certificate ?
    generateCertWithX509(privateKey) :
    generateCertLegacy(privateKey, publicKey);

  fs.writeFileSync(keyPath, privateKey);
  fs.writeFileSync(certPath, cert);

  console.log("Certificate generated at certs/");
  return { key: privateKey, cert };
}

function generateCertWithX509(privateKey) {
  // Node 20+ has built-in X509Certificate creation
  if (!crypto.createSign) throw new Error("fallback");

  // Build a self-signed cert manually using ASN.1 DER encoding
  const sign = crypto.createSign("SHA256");
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Use a minimal self-signed approach via createSelfSignedCert helper
  return buildSelfSignedCert(privateKey, notBefore, notAfter);
}

function generateCertLegacy(privateKey, publicKey) {
  return buildSelfSignedCert(privateKey, new Date(), new Date(Date.now() + 365 * 86400000));
}

function buildSelfSignedCert(privateKey, notBefore, notAfter) {
  // ASN.1 DER helper functions
  function derLength(len) {
    if (len < 0x80) return Buffer.from([len]);
    if (len < 0x100) return Buffer.from([0x81, len]);
    return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  }

  function derSequence(...items) {
    const body = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
  }

  function derSet(...items) {
    const body = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x31]), derLength(body.length), body]);
  }

  function derOid(oidStr) {
    const parts = oidStr.split(".").map(Number);
    const bytes = [40 * parts[0] + parts[1]];
    for (let i = 2; i < parts.length; i++) {
      let v = parts[i];
      if (v < 128) { bytes.push(v); }
      else {
        const enc = [];
        enc.push(v & 0x7f);
        v >>= 7;
        while (v > 0) { enc.push(0x80 | (v & 0x7f)); v >>= 7; }
        bytes.push(...enc.reverse());
      }
    }
    const buf = Buffer.from(bytes);
    return Buffer.concat([Buffer.from([0x06]), derLength(buf.length), buf]);
  }

  function derUtf8String(str) {
    const buf = Buffer.from(str, "utf-8");
    return Buffer.concat([Buffer.from([0x0c]), derLength(buf.length), buf]);
  }

  function derInteger(n) {
    let hex = n.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    if (parseInt(hex[0], 16) >= 8) hex = "00" + hex;
    const buf = Buffer.from(hex, "hex");
    return Buffer.concat([Buffer.from([0x02]), derLength(buf.length), buf]);
  }

  function derBigInteger(buf) {
    if (buf[0] >= 0x80) buf = Buffer.concat([Buffer.from([0x00]), buf]);
    return Buffer.concat([Buffer.from([0x02]), derLength(buf.length), buf]);
  }

  function derBitString(buf) {
    const wrapped = Buffer.concat([Buffer.from([0x00]), buf]);
    return Buffer.concat([Buffer.from([0x03]), derLength(wrapped.length), wrapped]);
  }

  function derUtcTime(date) {
    const s = date.toISOString().replace(/[-:T]/g, "").slice(2, 14) + "Z";
    const buf = Buffer.from(s, "ascii");
    return Buffer.concat([Buffer.from([0x17]), derLength(buf.length), buf]);
  }

  function derExplicit(tag, content) {
    return Buffer.concat([Buffer.from([0xa0 | tag]), derLength(content.length), content]);
  }

  // Extract public key DER from private key
  const pubKeyObj = crypto.createPublicKey(privateKey);
  const pubKeyDer = pubKeyObj.export({ type: "spki", format: "der" });

  // Subject: CN=playwright-reports
  const cn = derSequence(derOid("2.5.4.3"), derUtf8String("playwright-reports"));
  const subject = derSequence(derSet(cn));

  // Serial number (random)
  const serial = derBigInteger(crypto.randomBytes(8));

  // Signature algorithm: SHA256withRSA = 1.2.840.113549.1.1.11
  const sigAlg = derSequence(derOid("1.2.840.113549.1.1.11"), Buffer.from([0x05, 0x00]));

  // Validity
  const validity = derSequence(derUtcTime(notBefore), derUtcTime(notAfter));

  // Version 3
  const version = derExplicit(0, derInteger(2));

  // TBS Certificate
  const tbs = derSequence(version, serial, sigAlg, subject, validity, subject, pubKeyDer);

  // Sign TBS
  const signer = crypto.createSign("SHA256");
  signer.update(tbs);
  const signature = signer.sign(privateKey);

  // Full certificate
  const cert = derSequence(tbs, sigAlg, derBitString(signature));

  return `-----BEGIN CERTIFICATE-----\n${cert.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;
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
