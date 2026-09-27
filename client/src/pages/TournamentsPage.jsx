import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TournamentCard from "../components/TournamentCard";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./TournamentsPage.module.css";

export default function TournamentsPage() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";

  const activeTournaments = tournaments.filter(
    (tournament) => tournament.status !== "complete"
  );

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.actionsRow}>
          <h1>Tournaments</h1>

          <div className={styles.buttons}>
            <button onClick={() => navigate("/stats")}>Stats</button>

            {isAdmin && (
              <button onClick={() => navigate("/setup")}>
                New tournament
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  sessionStorage.removeItem("isAdmin");
                  navigate("/");
                }}
              >
                Log out
              </button>
            )}
          </div>
        </div>

        <div className={styles.grid}>
          {activeTournaments.length === 0 ? (
            <p>No active tournaments right now.</p>
          ) : (
            activeTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                name={tournament.name}
                date={tournament.date}
                status={tournament.status}
                teamCount={tournament.teams.length}
                onClick={() =>
                  navigate(`/tournament/${tournament.id}`)
                }
              />
            ))
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}