import fs from "node:fs";
import path from "node:path";

const LOCAL_DIR = process.env.LOCAL_REPORTS_DIR || "C:\\playwright-reports\\data";
const REPORTS_PREFIX = process.env.REPORTS_PREFIX || "reports";

let cachedSummaries = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;

export function getLocalDir() {
  return LOCAL_DIR;
}

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walkDir(full, results);
    else results.push(full);
  }
  return results;
}

export async function listSummaries() {
  const now = Date.now();
  if (cachedSummaries && now - cacheTimestamp < CACHE_TTL) {
    return cachedSummaries;
  }

  const reportsDir = path.join(LOCAL_DIR, REPORTS_PREFIX);
  const allFiles = walkDir(reportsDir);
  const summaryFiles = allFiles.filter((f) => f.endsWith("summary.json"));

  const summaries = [];
  for (const file of summaryFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      summaries.push(JSON.parse(content));
    } catch (e) {
      console.warn(`Failed to parse ${file}: ${e.message}`);
    }
  }

  summaries.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  cachedSummaries = summaries;
  cacheTimestamp = now;
  return summaries;
}
