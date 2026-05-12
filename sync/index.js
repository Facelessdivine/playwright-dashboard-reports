import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import cron from "node-cron";

const BUCKET = process.env.REPORT_BUCKET || "reports_bucket_26";
const LOCAL_DIR = process.env.LOCAL_REPORTS_DIR || "C:\\playwright-reports\\data";
const SYNC_INTERVAL = process.env.SYNC_INTERVAL || "*/5 * * * *"; // every 5 minutes

function runSync() {
  const source = `gs://${BUCKET}/reports/`;
  const dest = path.join(LOCAL_DIR, "reports");
  const timestamp = new Date().toISOString();

  fs.mkdirSync(dest, { recursive: true });

  console.log(`[${timestamp}] Syncing ${source} → ${dest}`);

  try {
    execSync(`gsutil -m rsync -r "${source}" "${dest}"`, {
      stdio: "pipe",
      timeout: 5 * 60 * 1000,
    });
    console.log(`[${new Date().toISOString()}] Sync completed.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Sync error: ${err.message}`);
  }
}

export function startSync() {
  if (!LOCAL_DIR) {
    console.error("LOCAL_REPORTS_DIR is required for sync.");
    process.exit(1);
  }

  console.log(`Sync scheduled: "${SYNC_INTERVAL}" | gs://${BUCKET}/reports/ → ${path.join(LOCAL_DIR, "reports")}`);

  // Run immediately on startup
  runSync();

  // Then schedule
  cron.schedule(SYNC_INTERVAL, runSync);
}
