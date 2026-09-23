// client/src/pages/TournamentsPage.jsx
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TournamentCard from "../components/TournamentCard";
import styles from "./TournamentsPage.module.css";

const mockTournaments = [
  { id: "1", name: "Valorant — Friday night", date: "Sep 19, 2026", status: "complete", teamCount: 8 },
  { id: "2", name: "Tekken 8 — Squad rumble", date: "Sep 22, 2026", status: "in_progress", teamCount: 5 },
];

export default function TournamentsPage() {
  const navigate = useNavigate();

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.actionsRow}>
          <h1>Tournaments</h1>
          <div className={styles.buttons}>
            <button onClick={() => navigate("/stats")}>Stats</button>
            <button onClick={() => navigate("/setup")}>New tournament</button>
          </div>
        </div>
        <div className={styles.grid}>
          {mockTournaments.map((t) => (
            <TournamentCard
              key={t.id}
              name={t.name}
              date={t.date}
              status={t.status}
              teamCount={t.teamCount}
              onClick={() => navigate(`/tournament/${t.id}`)}
            />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}