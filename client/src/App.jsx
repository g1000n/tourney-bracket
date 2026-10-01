import { BrowserRouter, Routes, Route } from "react-router-dom";
import TournamentsPage from "./pages/TournamentsPage";
import SetupPage from "./pages/SetupPage";
import BracketViewPage from "./pages/BracketViewPage";
import StatsPage from "./pages/StatsPage";
import AdminLoginPage from "./pages/AdminLoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentsPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/tournament/:id" element={<BracketViewPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}