import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Projects from "./pages/Projects";
import Runs from "./pages/Runs";
import RunDetail from "./pages/RunDetail";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:project" element={<Runs />} />
        <Route path="/runs/:runId" element={<RunDetail />} />
      </Routes>
    </Layout>
  );
}
