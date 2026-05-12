import express from "express";
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
const DASHBOARD_DIR = path.join(__dirname, "dashboard", "dist");

// API + file proxy
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", apiRouter);
app.use("/files", proxyRouter);

// Dashboard SPA
if (fs.existsSync(path.join(DASHBOARD_DIR, "index.html"))) {
  app.use(express.static(DASHBOARD_DIR));
  app.get("*", (req, res) => {
    res.sendFile(path.join(DASHBOARD_DIR, "index.html"));
  });
} else {
  console.warn("Dashboard not built. Run: npm run build:dashboard");
}

// Start sync + server
startSync();

app.listen(PORT, () => {
  console.log(`Reports dashboard running on http://localhost:${PORT} [LOCAL: ${getLocalDir()}]`);
});
