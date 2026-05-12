import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchRun, reportUrl } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import "./RunDetail.css";

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDuration(sec) {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function RunDetail() {
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRun(runId)
      .then(setRun)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <p className="loading">Loading run...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!run) return <p className="error">Run not found.</p>;

  const htmlUrl = run.links?.htmlPrefix ? reportUrl(run.links.htmlPrefix) : null;

  return (
    <div className="run-detail">
      <div className="detail-header">
        <div>
          <h1>
            <Link to={`/projects/${encodeURIComponent(run.project)}`}>{run.project}</Link>
            <span className="sep">/</span>
            {run.branch}
          </h1>
          <p className="run-id">Run: {run.runId}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="detail-grid">
        <div className="stat">
          <span className="stat-label">Started</span>
          <span>{formatDate(run.startedAt)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Duration</span>
          <span>{formatDuration(run.durationSec)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Shards</span>
          <span>{run.shards}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Commit</span>
          <span className="mono">{run.commit ? run.commit.slice(0, 10) : "-"}</span>
        </div>
        <div className="stat passed">
          <span className="stat-label">Passed</span>
          <span className="stat-num">{run.tests?.passed ?? 0}</span>
        </div>
        <div className="stat failed">
          <span className="stat-label">Failed</span>
          <span className="stat-num">{run.tests?.failed ?? 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Skipped</span>
          <span className="stat-num">{run.tests?.skipped ?? 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total</span>
          <span className="stat-num">{run.tests?.total ?? 0}</span>
        </div>
      </div>

      {htmlUrl && (
        <div className="report-section">
          <div className="report-bar">
            <h2>HTML Report</h2>
            <a href={htmlUrl} target="_blank" rel="noopener noreferrer">
              Open in new tab
            </a>
          </div>
          <iframe
            className="report-frame"
            src={htmlUrl}
            title="Playwright HTML Report"
          />
        </div>
      )}
    </div>
  );
}
