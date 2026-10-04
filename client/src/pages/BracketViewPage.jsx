import { useState, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import {
  FORMATS,
  MATCH_LENGTHS,
  roundMatches,
  slotLabel,
  isReady,
  hasStarted,
  hasResults,
  canReopen,
  computeStandings,
  podium,
  matchBestOf,
  matchLengthLabel,
  winsNeeded,
  validateScore,
  validateLiveScore,
} from "../lib/bracket";
import styles from "./BracketViewPage.module.css";

const toValue = (bestOf) => (bestOf == null ? "free" : String(bestOf));
const fromValue = (value) => (value === "free" ? null : Number(value));

// One match. Admins score it right here: −/+ or type the number, then
// Finish. Every change is saved as it happens (live score).
function MatchCard({ tournament, match, isAdmin }) {
  const { setLiveScore, finishMatch, reopenMatch } = useTournaments();
  const [error, setError] = useState("");
  const bestOf = matchBestOf(tournament, match.id);
  const scoring = isAdmin && isReady(match);
  const live = isReady(match) && hasStarted(match);

  let note = "";
  if (match.isVoid) note = "Not needed";
  else if (match.isBye) note = "Bye";
  else if (live) note = "Live";
  else if (isReady(match)) note = "Ready";

  const a = match.scoreA ?? 0;
  const b = match.scoreB ?? 0;
  const scoreFor = (slot) => (slot === "A" ? a : b);
  const withScore = (slot, value) => (slot === "A" ? [value, b] : [a, value]);
  const allowed = (slot, value) => validateLiveScore(...withScore(slot, value), bestOf) === null;

  async function change(slot, value) {
    setError((await setLiveScore(tournament.id, match.id, ...withScore(slot, value))) || "");
  }

  const finishProblem = validateScore(a, b, bestOf);

  return (
    <div className={`${styles.matchCard} ${match.isVoid || match.isBye ? styles.muted : ""} ${live ? styles.live : ""}`}>
      <span className={styles.matchMeta}>
        <span>{match.code}</span>
        {note && <span className={live ? styles.liveNote : ""}>{note}</span>}
      </span>
      {!match.isVoid &&
        ["A", "B"].map((slot) => {
          const team = slot === "A" ? match.teamA : match.teamB;
          const score = slot === "A" ? match.scoreA : match.scoreB;
          const won = team && match.winnerId === team.id;
          const name = slotLabel(tournament.allMatches, match, slot);
          return (
            <span key={slot} className={`${styles.slot} ${won ? styles.winner : ""} ${team ? "" : styles.placeholder}`}>
              <span className={styles.slotName} title={name}>
                {name}
              </span>
              {scoring ? (
                <span className={styles.scoreControls}>
                  <button
                    type="button"
                    aria-label={`Remove a point from ${team.name}`}
                    disabled={!allowed(slot, scoreFor(slot) - 1)}
                    onClick={() => change(slot, scoreFor(slot) - 1)}
                  >
                    −
                  </button>
                  <input
                    aria-label={`${team.name} score`}
                    inputMode="numeric"
                    value={scoreFor(slot)}
                    onChange={(e) => change(slot, Number(e.target.value.replace(/\D/g, "") || 0))}
                  />
                  <button
                    type="button"
                    aria-label={`Add a point to ${team.name}`}
                    disabled={!allowed(slot, scoreFor(slot) + 1)}
                    onClick={() => change(slot, scoreFor(slot) + 1)}
                  >
                    +
                  </button>
                </span>
              ) : (
                <span className={styles.score}>{score ?? ""}</span>
              )}
            </span>
          );
        })}

      {scoring && (
        <div className={styles.cardActions}>
          <span className={styles.cardHint}>{bestOf ? `First to ${winsNeeded(bestOf)}` : "Free score"}</span>
          <button
            type="button"
            className={styles.finishBtn}
            disabled={Boolean(finishProblem)}
            title={finishProblem || "Lock in this result"}
            onClick={async () => setError((await finishMatch(tournament.id, match.id)) || "")}
          >
            Finish
          </button>
        </div>
      )}

      {isAdmin && match.winnerId && !match.isBye && (
        <div className={styles.cardActions}>
          <span />
          <button
            type="button"
            className={styles.linkBtn}
            disabled={!canReopen(tournament.allMatches, match)}
            title={
              canReopen(tournament.allMatches, match)
                ? "Reopen this match to change the score"
                : "A later match that depends on this result has already started"
            }
            onClick={async () => setError((await reopenMatch(tournament.id, match.id)) || "")}
          >
            Edit result
          </button>
        </div>
      )}

      {error && <p className={styles.cardError}>{error}</p>}
    </div>
  );
}

function RoundHeader({ tournament, round, isAdmin }) {
  const { setRoundBestOf } = useTournaments();
  const [error, setError] = useState("");
  const index = tournament.rounds.indexOf(round);
  const matches = roundMatches(tournament, round);
  const started = matches.some((m) => hasStarted(m) || (m.winnerId && !m.isBye));
  const bestOf = round.bestOf !== undefined ? round.bestOf : (tournament.bestOf ?? null);

  return (
    <div className={styles.roundHead}>
      <p className={styles.roundTitle}>{round.label}</p>
      {isAdmin && !started ? (
        <select
          className={styles.roundLength}
          aria-label={`${round.label} match length`}
          value={toValue(bestOf)}
          onChange={async (e) => setError((await setRoundBestOf(tournament.id, index, fromValue(e.target.value))) || "")}
        >
          {MATCH_LENGTHS.map((l) => (
            <option key={l.label} value={toValue(l.value)}>
              {l.label}
            </option>
          ))}
        </select>
      ) : (
        <span className={styles.roundLengthText}>{matchLengthLabel(bestOf)}</span>
      )}
      {error && <p className={styles.cardError}>{error}</p>}
    </div>
  );
}

// `wrap` lays rounds out as a wrapping grid instead of one long row that
// scrolls sideways. Used for round robin, where rounds aren't a bracket.
// The bracket's connectors, drawn like the curly braces in the logo: each
// pair of matches is joined by a "}" whose point leads to the match their
// winners play next. A match with only one feeder in this section (a
// losers-bracket round where the other player drops in from the winners
// bracket) gets a plain elbow line. Positions are measured from the cards
// themselves, so the lines follow the layout at any size.
function braceToPath(feeders, target) {
  const x1 = Math.max(...feeders.map((f) => f.right));
  const gap = target.left - x1;
  if (gap < 16) return null;
  const xs = x1 + Math.min(18, gap / 3); // the brace's spine
  const ys = feeders.map((f) => f.mid).sort((a, b) => a - b);
  const yT = target.mid;

  if (ys.length === 1) {
    return `M${x1} ${ys[0]} H${xs} V${yT} H${target.left}`;
  }

  const yTop = ys[0];
  const yBot = ys[ys.length - 1];
  const r = Math.max(2, Math.min(14, (yBot - yTop) / 4));
  // The brace's point sits between the two feeders; if the next match is
  // higher or lower than that, a short elbow carries the line to it.
  const yTip = Math.min(Math.max(yT, yTop + 2 * r), yBot - 2 * r);
  const xTip = xs + r;
  const toTarget =
    yTip === yT
      ? `M${xTip} ${yTip} H${target.left}`
      : `M${xTip} ${yTip} H${xTip + (target.left - xTip) / 2} V${yT} H${target.left}`;
  return [
    `M${x1} ${yTop} C${xs} ${yTop} ${xs} ${yTop} ${xs} ${yTop + r}`,
    `V${yTip - r} C${xs} ${yTip} ${xs} ${yTip} ${xTip} ${yTip}`,
    `C${xs} ${yTip} ${xs} ${yTip} ${xs} ${yTip + r}`,
    `V${yBot - r} C${xs} ${yBot} ${xs} ${yBot} ${x1} ${yBot}`,
    toTarget,
  ].join(" ");
}

function Connectors({ canvasRef, tournament }) {
  const [paths, setPaths] = useState([]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    function measure() {
      const box = canvas.getBoundingClientRect();
      const pos = new Map();
      canvas.querySelectorAll("[data-match-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        pos.set(el.dataset.matchId, {
          left: r.left - box.left,
          right: r.right - box.left,
          mid: r.top - box.top + r.height / 2,
        });
      });
      const feedersOf = new Map();
      for (const m of tournament.allMatches) {
        if (!m.nextMatchId || !pos.has(m.id) || !pos.has(m.nextMatchId)) continue;
        if (!feedersOf.has(m.nextMatchId)) feedersOf.set(m.nextMatchId, []);
        feedersOf.get(m.nextMatchId).push(pos.get(m.id));
      }
      const next = [...feedersOf].map(([id, feeders]) => braceToPath(feeders, pos.get(id))).filter(Boolean);
      setPaths((prev) => (prev.join("|") === next.join("|") ? prev : next));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  return (
    <svg className={styles.connectors} aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// `wrap` lays rounds out as a wrapping grid (round robin, where rounds
// aren't a bracket); otherwise rounds are bracket columns joined by braces.
function RoundColumns({ tournament, rounds, isAdmin, wrap = false }) {
  const canvasRef = useRef(null);
  const columns = rounds.map((round) => {
    // Matches voided by byes on both sides never happen; hide them.
    // The grand final reset stays visible so "Not needed" is explicit.
    const matches = roundMatches(tournament, round).filter((m) => !m.isVoid || m.isReset);
    if (matches.length === 0) return null;
    return (
      <div key={round.label} className={styles.roundCol}>
        <RoundHeader tournament={tournament} round={round} isAdmin={isAdmin} />
        <div className={styles.roundMatches}>
          {matches.map((match) => (
            <div key={match.id} data-match-id={match.id}>
              <MatchCard tournament={tournament} match={match} isAdmin={isAdmin} />
            </div>
          ))}
        </div>
      </div>
    );
  });

  if (wrap) return <div className={styles.roundsGrid}>{columns}</div>;
  return (
    <div className={styles.roundsRow}>
      <div className={styles.bracketCanvas} ref={canvasRef}>
        {columns}
        <Connectors canvasRef={canvasRef} tournament={tournament} />
      </div>
    </div>
  );
}

function Standings({ tournament }) {
  const rows = computeStandings(tournament.teams, tournament.allMatches);
  return (
    <table className={styles.standings}>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>P</th>
          <th>W</th>
          <th>L</th>
          <th>+/−</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const diff = r.pointsFor - r.pointsAgainst;
          return (
            <tr key={r.team.id}>
              <td>{i + 1}</td>
              <td>{r.team.name}</td>
              <td>{r.played}</td>
              <td>{r.wins}</td>
              <td>{r.losses}</td>
              <td>{diff > 0 ? `+${diff}` : diff}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Admin-only tools, tucked into a collapsible panel on this page.
function AdminPanel({ tournament }) {
  const navigate = useNavigate();
  const { renamePlayer, removePlayer, deleteTournament } = useTournaments();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const locked = hasResults(tournament);

  // Renames the player everywhere: a player is one record across every
  // tournament and game.
  async function saveName(team) {
    const problem = await renamePlayer(team.name, draft);
    setMessage(problem || "");
    if (!problem) setEditing(null);
  }

  async function remove(team) {
    if (!window.confirm(`Remove ${team.name}? The bracket will be rebuilt without them.`)) return;
    setMessage((await removePlayer(tournament.id, team.id)) || "");
  }

  async function removeTournament() {
    if (!window.confirm(`Delete "${tournament.name}" and all its results? This can't be undone.`)) return;
    const problem = await deleteTournament(tournament.id);
    if (problem) setMessage(problem);
    else navigate("/");
  }

  const players = [...tournament.teams].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));

  return (
    <details className={styles.adminPanel}>
      <summary>Manage tournament</summary>
      <div className={styles.adminBody}>
        <p className={styles.adminHint}>
          {locked
            ? "Matches have started, so players can be renamed but not removed. To change a result, use Edit result on the match."
            : "Removing a player rebuilds the bracket without them."}{" "}
          Renaming changes the player's name in every tournament.
        </p>
        <ul className={styles.playerList}>
          {players.map((team) => (
            <li key={team.id}>
              <span className={styles.seedTag}>{team.seed ? `#${team.seed}` : ""}</span>
              {editing === team.id ? (
                <>
                  <input
                    aria-label={`New name for ${team.name}`}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(team);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button type="button" onClick={() => saveName(team)}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.playerName}>{team.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(team.id);
                      setDraft(team.name);
                      setMessage("");
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    title={locked ? "Can't remove players once matches have started" : `Remove ${team.name}`}
                    onClick={() => remove(team)}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {message && <p className={styles.cardError}>{message}</p>}
        <button type="button" className={styles.dangerBtn} onClick={removeTournament}>
          Delete tournament
        </button>
      </div>
    </details>
  );
}

export default function BracketViewPage() {
  const { id } = useParams();
  const { tournaments, loading } = useTournaments();
  const tournament = tournaments.find((t) => t.id === id);
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";

  if (!tournament) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <BackLink />
          <p>{loading ? "Loading…" : "Tournament not found."}</p>
        </main>
        <Footer />
      </>
    );
  }

  const columns = (rounds, wrap = false) => (
    <RoundColumns tournament={tournament} rounds={rounds} isAdmin={isAdmin} wrap={wrap} />
  );
  const bySide = (side) => tournament.rounds.filter((r) => r.side === side);
  const places = podium(tournament);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink />
        <div className={styles.titleRow}>
          <h1>{tournament.name}</h1>
          <span className={`${styles.pill} ${styles[tournament.format] || ""}`}>{FORMATS[tournament.format].label}</span>
          <span className={tournament.status === "complete" ? styles.pillComplete : styles.pill}>
            {tournament.status === "complete" ? "Complete" : "In progress"}
          </span>
        </div>

        {isAdmin && <AdminPanel tournament={tournament} />}

        {places?.first && (
          <div className={styles.podium}>
            <span>
              <strong>Champion:</strong> {places.first.name}
            </span>
            {places.second && <span>2nd: {places.second.name}</span>}
            {places.third && <span>3rd: {places.third.name}</span>}
          </div>
        )}

        {!isAdmin && tournament.status !== "complete" && (
          <p className={styles.viewerNote}>Viewing only. Scores are entered by the tournament admin.</p>
        )}

        {tournament.format === "double_elimination" && (
          <>
            <h2 className={`${styles.sectionTitle} ${styles.secWinners}`}>Winners bracket</h2>
            {columns(bySide("winners"))}
            {bySide("losers").length > 0 && (
              <>
                <h2 className={`${styles.sectionTitle} ${styles.secLosers}`}>Losers bracket</h2>
                {columns(bySide("losers"))}
              </>
            )}
            <h2 className={`${styles.sectionTitle} ${styles.secFinals}`}>Finals</h2>
            {columns(bySide("final"))}
          </>
        )}

        {tournament.format === "round_robin" && (
          <>
            <h2 className={`${styles.sectionTitle} ${styles.secPlain}`}>Standings</h2>
            <Standings tournament={tournament} />
            <h2 className={`${styles.sectionTitle} ${styles.secPlain}`}>Schedule</h2>
            {columns(tournament.rounds, true)}
          </>
        )}

        {tournament.format === "single_elimination" && columns(tournament.rounds)}
      </main>
      <Footer />
    </>
  );
}
