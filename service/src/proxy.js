import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { getLocalDir } from "./gcs.js";

const router = Router();

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".zip": "application/zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
};

router.get("/*", (req, res) => {
  const reqPath = req.params[0];
  if (!reqPath) return res.status(400).json({ error: "No file path" });

  const localDir = getLocalDir();
  const localPath = path.join(localDir, reqPath);
  const resolved = path.resolve(localPath);

  if (!resolved.startsWith(path.resolve(localDir))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: "Not found" });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  fs.createReadStream(resolved).pipe(res);
});

export { router as proxyRouter };
