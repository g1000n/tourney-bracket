import { BrowserRouter, Routes, Route } from "react-router-dom";
import TournamentsPage from "./pages/TournamentsPage";
import SetupPage from "./pages/SetupPage";
import BracketViewPage from "./pages/BracketViewPage";
import MatchDetailPage from "./pages/MatchDetailPage";
import StatsPage from "./pages/StatsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentsPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/tournament/:id" element={<BracketViewPage />} />
        <Route path="/tournament/:id/match/:matchId" element={<MatchDetailPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  );
}