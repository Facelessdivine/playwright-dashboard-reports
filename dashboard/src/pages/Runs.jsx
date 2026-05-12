import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { fetchRuns } from "../api/client";
import RunTable from "../components/RunTable";
import "./Runs.css";

export default function Runs() {
  const { project } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const branch = searchParams.get("branch") || "";

  const [runs, setRuns] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchRuns(project, branch || undefined)
      .then((data) => {
        setRuns(data);
        const unique = [...new Set(data.map((r) => r.branch))];
        setBranches(unique);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [project, branch]);

  return (
    <div>
      <div className="runs-header">
        <h1>{decodeURIComponent(project)}</h1>
        <select
          className="branch-filter"
          value={branch}
          onChange={(e) => {
            const val = e.target.value;
            if (val) setSearchParams({ branch: val });
            else setSearchParams({});
          }}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {loading && <p className="loading">Loading runs...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && <RunTable runs={runs} />}
    </div>
  );
}
