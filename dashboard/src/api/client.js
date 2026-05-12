const API_BASE = import.meta.env.VITE_API_URL || "";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export function fetchProjects() {
  return request("/api/projects");
}

export function fetchRuns(project, branch) {
  const params = new URLSearchParams();
  if (project) params.set("project", project);
  if (branch) params.set("branch", branch);
  return request(`/api/runs?${params}`);
}

export function fetchRun(runId) {
  return request(`/api/runs/${encodeURIComponent(runId)}`);
}

export function reportUrl(htmlPrefix) {
  return `${API_BASE}/files/${htmlPrefix}/index.html`;
}
