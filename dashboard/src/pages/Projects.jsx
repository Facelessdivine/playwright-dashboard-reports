import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchProjects } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import "./Projects.css";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading projects...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!projects.length) return <p className="empty">No projects found.</p>;

  return (
    <div>
      <h1>Projects</h1>
      <div className="project-grid">
        {projects.map((p) => (
          <Link to={`/projects/${encodeURIComponent(p.name)}`} className="project-card" key={p.name}>
            <h2>{p.name}</h2>
            <div className="project-stats">
              <span>{p.totalRuns} runs</span>
              <span>{p.branches.length} branches</span>
            </div>
            {p.latestRun && (
              <div className="project-latest">
                <StatusBadge status={p.latestRun.status} />
                <span className="latest-branch">{p.latestRun.branch}</span>
              </div>
            )}
            <div className="project-bar">
              <div className="bar-passed" style={{ flex: p.passed }} />
              <div className="bar-failed" style={{ flex: p.failed }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
