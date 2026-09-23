import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./MatchDetailPage.module.css";

export default function MatchDetailPage() {
  const { id, matchId } = useParams();
  const navigate = useNavigate();
  const { tournaments, submitMatchResult } = useTournaments();
  const tournament = tournaments.find((t) => t.id === id);
  const match = tournament?.allMatches.find((m) => m.id === matchId);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [error, setError] = useState("");

  if (!tournament || !match) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <BackLink to={`/tournament/${id}`}>← Back to bracket</BackLink>
          <p>Match not found.</p>
        </main>
        <Footer />
      </>
    );
  }

  function handleSave() {
    if (Number(scoreA) === Number(scoreB)) {
      setError("Scores can't tie — single elimination needs a winner.");
      return;
    }
    submitMatchResult(id, matchId, Number(scoreA), Number(scoreB));
    navigate(`/tournament/${id}`);
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink to={`/tournament/${id}`}>← Back to bracket</BackLink>
        <div className={styles.matchup}>
          <div className={styles.side}>
            <p>{match.teamA?.name}</p>
            <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} />
          </div>
          <span>vs</span>
          <div className={styles.side}>
            <p>{match.teamB?.name}</p>
            <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
          </div>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.saveBtn} onClick={handleSave}>Save result</button>
      </main>
      <Footer />
    </>
  );
}