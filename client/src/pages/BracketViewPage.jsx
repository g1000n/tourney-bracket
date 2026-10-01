import { useState } from "react";
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

  function change(slot, value) {
    setError(setLiveScore(tournament.id, match.id, ...withScore(slot, value)) || "");
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
            onClick={() => setError(finishMatch(tournament.id, match.id) || "")}
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
            onClick={() => setError(reopenMatch(tournament.id, match.id) || "")}
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
          onChange={(e) => setRoundBestOf(tournament.id, index, fromValue(e.target.value))}
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
    </div>
  );
}

// `wrap` lays rounds out as a wrapping grid instead of one long row that
// scrolls sideways. Used for round robin, where rounds aren't a bracket.
function RoundColumns({ tournament, rounds, isAdmin, wrap = false }) {
  return (
    <div className={wrap ? styles.roundsGrid : styles.roundsRow}>
      {rounds.map((round) => {
        // Matches voided by byes on both sides never happen; hide them.
        // The grand final reset stays visible so "Not needed" is explicit.
        const matches = roundMatches(tournament, round).filter((m) => !m.isVoid || m.isReset);
        if (matches.length === 0) return null;
        return (
          <div key={round.label} className={styles.roundCol}>
            <RoundHeader tournament={tournament} round={round} isAdmin={isAdmin} />
            {matches.map((match) => (
              <MatchCard key={match.id} tournament={tournament} match={match} isAdmin={isAdmin} />
            ))}
          </div>
        );
      })}
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

  function saveName(teamId) {
    const problem = renamePlayer(tournament.id, teamId, draft);
    setMessage(problem || "");
    if (!problem) setEditing(null);
  }

  function remove(team) {
    if (!window.confirm(`Remove ${team.name}? The bracket will be rebuilt without them.`)) return;
    setMessage(removePlayer(tournament.id, team.id) || "");
  }

  function removeTournament() {
    if (!window.confirm(`Delete "${tournament.name}" and all its results? This can't be undone.`)) return;
    deleteTournament(tournament.id);
    navigate("/");
  }

  const players = [...tournament.teams].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));

  return (
    <details className={styles.adminPanel}>
      <summary>Manage tournament</summary>
      <div className={styles.adminBody}>
        <p className={styles.adminHint}>
          {locked
            ? "Matches have started, so players can be renamed but not removed. To change a result, use Edit result on the match."
            : "Removing a player rebuilds the bracket without them."}
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
                      if (e.key === "Enter") saveName(team.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button type="button" onClick={() => saveName(team.id)}>
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
  const { tournaments } = useTournaments();
  const tournament = tournaments.find((t) => t.id === id);
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";

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
          <span className={styles.pill}>{FORMATS[tournament.format].label}</span>
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
            <h2 className={styles.sectionTitle}>Winners bracket</h2>
            {columns(bySide("winners"))}
            {bySide("losers").length > 0 && (
              <>
                <h2 className={styles.sectionTitle}>Losers bracket</h2>
                {columns(bySide("losers"))}
              </>
            )}
            <h2 className={styles.sectionTitle}>Finals</h2>
            {columns(bySide("final"))}
          </>
        )}

        {tournament.format === "round_robin" && (
          <>
            <h2 className={styles.sectionTitle}>Standings</h2>
            <Standings tournament={tournament} />
            <h2 className={styles.sectionTitle}>Schedule</h2>
            {columns(tournament.rounds, true)}
          </>
        )}

        {tournament.format === "single_elimination" && columns(tournament.rounds)}
      </main>
      <Footer />
    </>
  );
}
