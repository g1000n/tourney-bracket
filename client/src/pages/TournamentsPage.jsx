import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TournamentCard from "../components/TournamentCard";
import { useTournaments } from "../context/TournamentsContext";
import { FORMATS } from "../lib/bracket";
import wordmark from "../assets/logo-wordmark.svg";
import styles from "./TournamentsPage.module.css";

export default function TournamentsPage() {
  const navigate = useNavigate();
  const { tournaments, deleteTournament, loading } = useTournaments();
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
        {/* The home page is an old family computer: the wordmark and the
            tournaments sit on its green screen. */}
        <section className={styles.monitor} aria-labelledby="home-title">
          <div className={styles.screen}>
            <h1 id="home-title" className={styles.title}>
              <img src={wordmark} alt="TourneyBracket" className={styles.wordmark} />
            </h1>
            <svg className={styles.swoosh} viewBox="0 0 600 40" aria-hidden="true" preserveAspectRatio="none">
              <path d="M10 30 C 160 2, 420 2, 590 22" />
            </svg>
            <p className={styles.prompt}>
              {loading
                ? "Loading tournaments…"
                : sortedTournaments.length === 0
                  ? isAdmin
                    ? "No tournaments yet. Start one with New tournament."
                    : "No tournaments yet. Check back soon."
                  : "Pick a tournament to begin."}
            </p>

            {!loading && sortedTournaments.length > 0 && (
              <div className={styles.grid}>
                {sortedTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    name={tournament.name}
                    date={tournament.date}
                    status={tournament.status}
                    format={FORMATS[tournament.format]?.label}
                    formatKey={tournament.format}
                    teamCount={tournament.teams.length}
                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                    onDelete={
                      isAdmin
                        ? async () => {
                            if (window.confirm(`Delete "${tournament.name}" and all its results? This can't be undone.`)) {
                              const problem = await deleteTournament(tournament.id);
                              if (problem) window.alert(problem);
                            }
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
          <div className={styles.bezel} aria-hidden="true">
            <span className={styles.knob} />
            <span className={styles.knob} />
            <span className={styles.knob} />
            <span className={styles.knob} />
            <span className={styles.power} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
