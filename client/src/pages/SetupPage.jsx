import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import { FORMATS, MATCH_LENGTHS } from "../lib/bracket";
import styles from "./SetupPage.module.css";

// <select> values are strings; "free" stands for null (free scoring).
const toValue = (bestOf) => (bestOf == null ? "free" : String(bestOf));
const fromValue = (value) => (value === "free" ? null : Number(value));

export default function SetupPage() {
  const navigate = useNavigate();
  const { createTournament } = useTournaments();
  const [game, setGame] = useState("");
  const [roundName, setRoundName] = useState("");
  const [players, setPlayers] = useState([
    { name: "", seed: "" },
    { name: "", seed: "" },
  ]);
  const [format, setFormat] = useState("single_elimination");
  const [thirdPlace, setThirdPlace] = useState(true);
  const [randomSeeding, setRandomSeeding] = useState(true);
  const [bestOf, setBestOf] = useState(null);
  // undefined = same as the other rounds
  const [lateBestOf, setLateBestOf] = useState(undefined);
  const [error, setError] = useState("");

  const isAdmin = sessionStorage.getItem("isAdmin") === "true";
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const isElimination = format !== "round_robin";
  const usesSeeds = isElimination && !randomSeeding;
  const playerCount = players.filter((p) => p.name.trim()).length;

  // Any edit clears the last error, so a fixed problem doesn't keep showing.
  function edited(setter) {
    return (value) => {
      setError("");
      setter(value);
    };
  }

  function updatePlayer(index, field, value) {
    setError("");
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  // Seeds are whole numbers from 1 up. Blank means N/A (no seed).
  function updateSeed(index, raw) {
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
    updatePlayer(index, "seed", digits);
  }

  function addPlayer() {
    setError("");
    setPlayers((prev) => [...prev, { name: "", seed: "" }]);
  }

  function removePlayer(index) {
    setError("");
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleGenerate() {
    if (!game.trim()) {
      setError("Enter a game before generating.");
      return;
    }

    const validPlayers = players
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        rank: usesSeeds && p.seed ? parseInt(p.seed, 10) : null,
      }));

    if (validPlayers.length < 2) {
      setError("Add at least 2 players before generating.");
      return;
    }

    const names = validPlayers.map((p) => p.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setError("Two players have the same name. Give each player a unique name.");
      return;
    }

    const seeds = validPlayers.map((p) => p.rank).filter((r) => r != null);
    const repeated = seeds.find((s, i) => seeds.indexOf(s) !== i);
    if (repeated != null) {
      setError(`Two players have seed ${repeated}. Each seed can only be used once.`);
      return;
    }

    const wantsThirdPlace = format === "single_elimination" && thirdPlace;
    if (wantsThirdPlace && validPlayers.length < 4) {
      setError(
        `A 3rd-place match needs at least 4 players (you have ${validPlayers.length}). Add more players or untick the 3rd-place option.`
      );
      return;
    }

    try {
      const id = createTournament({
        game: game.trim(),
        roundName: roundName.trim(),
        players: validPlayers,
        format,
        thirdPlace: wantsThirdPlace,
        random: !usesSeeds,
        bestOf,
        lateBestOf: isElimination && lateBestOf !== undefined ? lateBestOf : bestOf,
      });
      navigate(`/tournament/${id}`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink />
        <h1>New tournament</h1>
        <div className={styles.field}>
          <label htmlFor="game">Game</label>
          <input id="game" value={game} onChange={(e) => edited(setGame)(e.target.value)} placeholder="e.g. Valorant" />
        </div>

        <div className={styles.field}>
          <label htmlFor="event">Event name (optional)</label>
          <input
            id="event"
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
            placeholder="e.g. Friday night"
          />
        </div>

        <fieldset className={styles.formatField}>
          <legend>Format</legend>
          <div className={styles.formatOptions}>
            {Object.entries(FORMATS).map(([key, f]) => (
              <label
                key={key}
                className={`${styles.formatOption} ${format === key ? styles.formatSelected : ""}`}
              >
                <input
                  type="radio"
                  name="format"
                  value={key}
                  checked={format === key}
                  onChange={() => edited(setFormat)(key)}
                />
                <span className={styles.formatName}>{f.label}</span>
                <span className={styles.formatDesc}>{f.description}</span>
              </label>
            ))}
          </div>
          {format === "single_elimination" && (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={thirdPlace}
                onChange={(e) => edited(setThirdPlace)(e.target.checked)}
              />
              Include a 3rd-place match (4+ players)
            </label>
          )}
          {format === "single_elimination" && thirdPlace && playerCount > 0 && playerCount < 4 && (
            <p className={styles.warning}>
              Needs at least 4 players — you have {playerCount}. Add more or untick this to generate.
            </p>
          )}
        </fieldset>

        <fieldset className={styles.formatField}>
          <legend>Match length</legend>
          <div className={styles.lengthRow}>
            <label className={styles.selectField}>
              <span>{isElimination ? "Early rounds" : "Every match"}</span>
              <select value={toValue(bestOf)} onChange={(e) => edited(setBestOf)(fromValue(e.target.value))}>
                {MATCH_LENGTHS.map((l) => (
                  <option key={l.label} value={toValue(l.value)}>
                    {l.label}
                    {l.value ? ` (${l.description.toLowerCase()})` : ""}
                  </option>
                ))}
              </select>
            </label>
            {isElimination && (
              <label className={styles.selectField}>
                <span>Semifinals onward</span>
                <select
                  value={lateBestOf === undefined ? "same" : toValue(lateBestOf)}
                  onChange={(e) =>
                    edited(setLateBestOf)(e.target.value === "same" ? undefined : fromValue(e.target.value))
                  }
                >
                  <option value="same">Same as early rounds</option>
                  {MATCH_LENGTHS.map((l) => (
                    <option key={l.label} value={toValue(l.value)}>
                      {l.label}
                      {l.value ? ` (${l.description.toLowerCase()})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className={styles.hint}>
            You can still change any round&apos;s match length on the bracket page until that round starts.
          </p>
        </fieldset>

        {isElimination && (
          <fieldset className={styles.formatField}>
            <legend>Seeding</legend>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={randomSeeding}
                onChange={(e) => edited(setRandomSeeding)(e.target.checked)}
              />
              Random seeding — shuffle everyone, ignore seeds
            </label>
            {!randomSeeding && (
              <p className={styles.hint}>
                Seed 1 is the top seed and meets the lowest seed first. Players left at N/A are shuffled in after
                the seeded players.
              </p>
            )}
          </fieldset>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Players</span>
          <div className={`${styles.playerRow} ${styles.playerHead}`} aria-hidden="true">
            <span>Name</span>
            <span>Seed</span>
            <span />
          </div>

          {players.map((p, i) => (
            <div key={i} className={styles.playerRow}>
              <input
                aria-label={`Player ${i + 1} name`}
                placeholder="Player name"
                value={p.name}
                onChange={(e) => updatePlayer(i, "name", e.target.value)}
              />
              <input
                aria-label={`Player ${i + 1} seed`}
                placeholder="N/A"
                inputMode="numeric"
                disabled={!usesSeeds}
                title={usesSeeds ? "Seed (1 = top seed)" : "Turn off random seeding to set seeds"}
                value={usesSeeds ? p.seed : ""}
                onChange={(e) => updateSeed(i, e.target.value)}
              />
              <button type="button" aria-label={`Remove player ${i + 1}`} onClick={() => removePlayer(i)}>
                ×
              </button>
            </div>
          ))}

          <button type="button" onClick={addPlayer}>
            Add player
          </button>
        </div>

        {playerCount >= 2 && (
          <p className={styles.hint}>
            {playerCount} players ·{" "}
            {FORMATS[format].matchCount(playerCount) +
              (format === "single_elimination" && thirdPlace && playerCount >= 4 ? 1 : 0)}{" "}
            matches
            {format === "double_elimination" ? " (+1 if the grand final is reset)" : ""}
            {isElimination ? (usesSeeds ? " · seeded" : " · random seeding") : ""}
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.generateBtn} onClick={handleGenerate}>
          {format === "round_robin" ? "Generate schedule" : "Generate bracket"}
        </button>
      </main>
      <Footer />
    </>
  );
}
