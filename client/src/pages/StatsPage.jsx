import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./StatsPage.module.css";

export default function StatsPage() {
  const { tournaments } = useTournaments();
  const [expanded, setExpanded] = useState(null);

  const gameCounts = {};
  tournaments.forEach((t) => {
    gameCounts[t.game] = (gameCounts[t.game] || 0) + 1;
  });

  const playerStats = {};
  tournaments.forEach((t) => {
    t.allMatches.forEach((m) => {
      if (!m.teamA || !m.teamB || !m.winnerId) return;
      [m.teamA, m.teamB].forEach((team) => {
        const key = team.name.toLowerCase();
        if (!playerStats[key]) playerStats[key] = { name: team.name, wins: 0, history: [] };
      });
      const aWon = m.winnerId === m.teamA.id;
      const aKey = m.teamA.name.toLowerCase();
      const bKey = m.teamB.name.toLowerCase();
      if (aWon) playerStats[aKey].wins++;
      else playerStats[bKey].wins++;
      playerStats[aKey].history.push({ tournament: t.name, opponent: m.teamB.name, result: aWon ? "W" : "L" });
      playerStats[bKey].history.push({ tournament: t.name, opponent: m.teamA.name, result: aWon ? "L" : "W" });
    });
  });
  const players = Object.values(playerStats).sort((a, b) => b.wins - a.wins);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink />
        <h1>Stats</h1>
        <div className={styles.columns}>
          <div>
            <h2>Games</h2>
            {Object.keys(gameCounts).length === 0 && <p>No games yet.</p>}
            {Object.entries(gameCounts).map(([game, count]) => (
              <div key={game} className={styles.row}>
                <span>{game}</span>
                <span>{count} tournament{count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
          <div>
            <h2>Players</h2>
            {players.length === 0 && <p>No players yet.</p>}
            {players.map((p) => (
              <div key={p.name}>
                <div
                  className={styles.row}
                  onClick={() => setExpanded(expanded === p.name ? null : p.name)}
                  style={{ cursor: "pointer" }}
                >
                  <span>{p.name}</span>
                  <span>{p.wins} win{p.wins === 1 ? "" : "s"}</span>
                </div>
                {expanded === p.name && (
                  <div className={styles.history}>
                    {p.history.map((h, i) => (
                      <div key={i} className={styles.historyRow}>
                        <span>{h.tournament}</span>
                        <span>vs {h.opponent}</span>
                        <span>{h.result}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}