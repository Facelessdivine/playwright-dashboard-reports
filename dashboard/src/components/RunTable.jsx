import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import { reportUrl } from "../api/client";
import "./RunTable.css";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(sec) {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function RunTable({ runs }) {
  if (!runs.length) {
    return <p className="empty">No runs found.</p>;
  }

  return (
    <table className="run-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Branch</th>
          <th>Date</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Skipped</th>
          <th>Duration</th>
          <th>Shards</th>
          <th>Report</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.runId}>
            <td><StatusBadge status={r.status} /></td>
            <td>{r.branch}</td>
            <td>{formatDate(r.startedAt)}</td>
            <td className="num green">{r.tests?.passed ?? 0}</td>
            <td className="num red">{r.tests?.failed ?? 0}</td>
            <td className="num muted">{r.tests?.skipped ?? 0}</td>
            <td>{formatDuration(r.durationSec)}</td>
            <td className="num">{r.shards}</td>
            <td>
              {r.links?.htmlPrefix && (
                <a
                  href={reportUrl(r.links.htmlPrefix)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
