import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TournamentCard from "../components/TournamentCard";
import { useTournaments } from "../context/TournamentsContext";
import { FORMATS } from "../lib/bracket";
import styles from "./TournamentsPage.module.css";

export default function TournamentsPage() {
  const navigate = useNavigate();
  const { tournaments, deleteTournament } = useTournaments();
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";

  // Completed tournaments stay listed (marked complete), after the
  // in-progress ones.
  const sortedTournaments = [...tournaments].sort(
    (a, b) => (a.status === "complete") - (b.status === "complete")
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
          {sortedTournaments.length === 0 ? (
            <p>No tournaments yet.</p>
          ) : (
            sortedTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                name={tournament.name}
                date={tournament.date}
                status={tournament.status}
                format={FORMATS[tournament.format]?.label}
                teamCount={tournament.teams.length}
                onClick={() =>
                  navigate(`/tournament/${tournament.id}`)
                }
                onDelete={
                  isAdmin
                    ? () => {
                        if (window.confirm(`Delete "${tournament.name}" and all its results? This can't be undone.`)) {
                          deleteTournament(tournament.id);
                        }
                      }
                    : undefined
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