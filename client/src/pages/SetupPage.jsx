import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./SetupPage.module.css";

export default function SetupPage() {
  const navigate = useNavigate();
  const { createTournament } = useTournaments();
  const [game, setGame] = useState("");
  const [roundName, setRoundName] = useState("");
  const [players, setPlayers] = useState([{ name: "", rank: "" }, { name: "", rank: "" }]);
  const [error, setError] = useState("");

  function updatePlayer(index, field, value) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }
  function addPlayer() {
    setPlayers((prev) => [...prev, { name: "", rank: "" }]);
  }
  function removePlayer(index) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleGenerate() {
    if (!game.trim()) {
      setError("Enter a game before generating.");
      return;
    }
    const validPlayers = players
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), rank: p.rank ? parseInt(p.rank, 10) : null }));

    if (validPlayers.length < 2) {
      setError("Add at least 2 players before generating.");
      return;
    }
    const id = createTournament({ game: game.trim(), roundName: roundName.trim(), players: validPlayers });
    navigate(`/tournament/${id}`);
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink />
        <h1>New tournament</h1>

        <div className={styles.field}>
          <label>Game</label>
          <input value={game} onChange={(e) => setGame(e.target.value)} placeholder="e.g. Valorant" />
        </div>

        <div className={styles.field}>
          <label>Round name (optional)</label>
          <input value={roundName} onChange={(e) => setRoundName(e.target.value)} placeholder="Friday night" />
        </div>

        <div className={styles.field}>
          <label>Players</label>
          {players.map((p, i) => (
            <div key={i} className={styles.playerRow}>
              <input placeholder="Player name" value={p.name} onChange={(e) => updatePlayer(i, "name", e.target.value)} />
              <input placeholder="Rank" type="number" value={p.rank} onChange={(e) => updatePlayer(i, "rank", e.target.value)} />
              <button type="button" onClick={() => removePlayer(i)}>×</button>
            </div>
          ))}
          <button type="button" onClick={addPlayer}>Add player</button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.generateBtn} onClick={handleGenerate}>Generate bracket</button>
      </main>
      <Footer />
    </>
  );
}