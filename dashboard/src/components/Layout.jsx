import { Link, useLocation } from "react-router-dom";
import "./Layout.css";

export default function Layout({ children }) {
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">Playwright Reports</Link>
        {crumbs.length > 1 && (
          <nav className="breadcrumbs">
            {crumbs.map((c, i) => (
              <span key={c.path}>
                {i > 0 && <span className="sep">/</span>}
                {i < crumbs.length - 1 ? (
                  <Link to={c.path}>{c.label}</Link>
                ) : (
                  <span className="current">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <a href="/install" className="install-link">Install Certificate</a>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function buildCrumbs(pathname) {
  const crumbs = [{ label: "Projects", path: "/" }];
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "projects" && parts[1]) {
    crumbs.push({ label: decodeURIComponent(parts[1]), path: `/projects/${parts[1]}` });
  }
  if (parts[0] === "runs" && parts[1]) {
    crumbs.push({ label: `Run ${parts[1].slice(0, 12)}`, path: `/runs/${parts[1]}` });
  }
  return crumbs;
}
