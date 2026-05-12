import { Router } from "express";
import { listSummaries } from "./gcs.js";

const router = Router();

// GET /api/projects
router.get("/projects", async (req, res) => {
  try {
    const summaries = await listSummaries();
    const projects = {};

    for (const s of summaries) {
      if (!projects[s.project]) {
        projects[s.project] = {
          name: s.project,
          totalRuns: 0,
          passed: 0,
          failed: 0,
          branches: new Set(),
          latestRun: null,
        };
      }
      const p = projects[s.project];
      p.totalRuns++;
      if (s.status === "passed") p.passed++;
      else p.failed++;
      if (s.branch) p.branches.add(s.branch);
      if (!p.latestRun || new Date(s.startedAt) > new Date(p.latestRun.startedAt)) {
        p.latestRun = s;
      }
    }

    const result = Object.values(projects).map((p) => ({
      ...p,
      branches: [...p.branches],
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs?project=X&branch=Y
router.get("/runs", async (req, res) => {
  try {
    let summaries = await listSummaries();
    if (req.query.project) {
      summaries = summaries.filter((s) => s.project === req.query.project);
    }
    if (req.query.branch) {
      summaries = summaries.filter((s) => s.branch === req.query.branch);
    }
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs/:runId
router.get("/runs/:runId", async (req, res) => {
  try {
    const summaries = await listSummaries();
    const run = summaries.find((s) => s.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as apiRouter };
