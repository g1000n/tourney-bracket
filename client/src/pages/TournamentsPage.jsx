// client/src/pages/TournamentsPage.jsx
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TournamentCard from "../components/TournamentCard";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./TournamentsPage.module.css";

export default function TournamentsPage() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();

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
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              name={t.name}
              date={t.date}
              status={t.status}
              teamCount={t.teams.length}
              onClick={() => navigate(`/tournament/${t.id}`)}
            />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}