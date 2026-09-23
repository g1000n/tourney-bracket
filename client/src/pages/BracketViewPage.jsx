import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./BracketViewPage.module.css";

export default function BracketViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const tournament = tournaments.find((t) => t.id === id);

  if (!tournament) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <BackLink />
          <p>Tournament not found.</p>
        </main>
        <Footer />
      </>
    );
  }

  const teamName = (team) => (team ? team.name : "TBD");
  const matchStatus = (match) => {
    if (!match.teamA || !match.teamB) return match.winnerId ? "bye" : "tbd";
    return match.winnerId ? "done" : "ready";
  };

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink />
        <div className={styles.titleRow}>
          <h1>{tournament.name}</h1>
          <span className={tournament.status === "complete" ? styles.pillComplete : styles.pill}>
            {tournament.status === "complete" ? "Complete" : "In progress"}
          </span>
        </div>

        <div className={styles.roundsRow}>
          {tournament.rounds.map((round, i) => (
            <div key={i} className={styles.roundCol}>
              <p className={styles.roundTitle}>{round.label}</p>
              {round.matches.map((match) => {
                const status = matchStatus(match);
                const clickable = status === "ready";
                return (
                  <div
                    key={match.id}
                    className={`${styles.matchCard} ${clickable ? styles.clickable : ""}`}
                    onClick={() => clickable && navigate(`/tournament/${id}/match/${match.id}`)}
                  >
                    <div className={match.winnerId === match.teamA?.id ? styles.winner : ""}>
                      {teamName(match.teamA)} {match.scoreA ?? ""}
                    </div>
                    <div className={match.winnerId === match.teamB?.id ? styles.winner : ""}>
                      {teamName(match.teamB)} {match.scoreB ?? ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}