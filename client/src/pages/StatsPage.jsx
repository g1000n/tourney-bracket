import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import BackLink from "../components/BackLink";
import { useTournaments } from "../context/TournamentsContext";
import { FORMATS, placements, podium } from "../lib/bracket";
import styles from "./StatsPage.module.css";

// Only real, played matches count: no byes, no voided or unfinished matches.
function playedMatches(t) {
  return t.allMatches.filter((m) => m.teamA && m.teamB && m.winnerId && !m.isBye);
}

// Players are matched across tournaments by name (known limitation until
// players have stable ids in the database). Wins and losses are always
// calculated from match results, never stored.
function buildLeaderboard(tournaments) {
  const stats = {};
  const get = (team) => {
    const key = team.name.toLowerCase();
    if (!stats[key]) stats[key] = { key, name: team.name, wins: 0, losses: 0, events: 0, titles: 0, history: [] };
    return stats[key];
  };

  tournaments.forEach((t) => {
    t.teams.forEach((team) => get(team).events++);
    const champ = podium(t)?.first;
    if (champ) get(champ).titles++;
    playedMatches(t).forEach((m) => {
      const aWon = m.winnerId === m.teamA.id;
      const a = get(m.teamA);
      const b = get(m.teamB);
      (aWon ? a : b).wins++;
      (aWon ? b : a).losses++;
      const base = { tournamentId: t.id, tournament: t.name };
      a.history.push({ ...base, opponent: m.teamB.name, result: aWon ? "W" : "L", score: `${m.scoreA}–${m.scoreB}` });
      b.history.push({ ...base, opponent: m.teamA.name, result: aWon ? "L" : "W", score: `${m.scoreB}–${m.scoreA}` });
    });
  });

  const rows = Object.values(stats).sort(
    (x, y) => y.wins - x.wins || x.losses - y.losses || y.titles - x.titles || x.name.localeCompare(y.name)
  );
  // Standard competition ranking: players level on wins and losses share a position.
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.position = prev && prev.wins === row.wins && prev.losses === row.losses ? prev.position : i + 1;
  });
  return rows;
}

function winRate(row) {
  const played = row.wins + row.losses;
  return played ? `${Math.round((row.wins / played) * 100)}%` : "—";
}

// Tournaments grouped by game (case-insensitive), most played first.
function groupByGame(tournaments) {
  const groups = new Map();
  tournaments.forEach((t) => {
    const key = t.game.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, name: t.game.trim(), tournaments: [] });
    groups.get(key).tournaments.push(t);
  });
  return [...groups.values()].sort((a, b) => b.tournaments.length - a.tournaments.length || a.name.localeCompare(b.name));
}

const includes = (text, q) => text.toLowerCase().includes(q);

function Chevron({ open }) {
  return (
    <span className={styles.chevron} aria-hidden="true">
      {open ? "▾" : "▸"}
    </span>
  );
}

function LeaderboardTable({ rows }) {
  if (rows.length === 0) return <p className={styles.muted}>No players match.</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>W</th>
          <th>L</th>
          <th>Win %</th>
          <th>Titles</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.key}>
            <td>{p.position}</td>
            <td>{p.name}</td>
            <td>{p.wins}</td>
            <td>{p.losses}</td>
            <td>{winRate(p)}</td>
            <td>{p.titles}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TournamentResults({ tournament }) {
  const places = placements(tournament);
  const record = {};
  tournament.teams.forEach((team) => (record[team.id] = { wins: 0, losses: 0 }));
  playedMatches(tournament).forEach((m) => {
    const aWon = m.winnerId === m.teamA.id;
    record[aWon ? m.teamA.id : m.teamB.id].wins++;
    record[aWon ? m.teamB.id : m.teamA.id].losses++;
  });
  const rows = [...tournament.teams].sort(
    (a, b) => places.get(a.id).order - places.get(b.id).order || record[b.id].wins - record[a.id].wins
  );

  return (
    <div className={styles.nested}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Seed</th>
            <th>W</th>
            <th>L</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((team, i) => (
            <tr key={team.id}>
              <td>{i + 1}</td>
              <td>{team.name}</td>
              <td>{team.seed ?? "—"}</td>
              <td>{record[team.id].wins}</td>
              <td>{record[team.id].losses}</td>
              <td>{places.get(team.id).label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link className={styles.openLink} to={`/tournament/${tournament.id}`}>
        Open bracket →
      </Link>
    </div>
  );
}

function TournamentRow({ tournament }) {
  const [open, setOpen] = useState(false);
  const champ = podium(tournament)?.first;
  const event = tournament.roundName || tournament.name;
  return (
    <li className={styles.tournamentItem}>
      <button type="button" className={styles.expander} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Chevron open={open} />
        <span className={styles.expanderMain}>
          <span className={styles.expanderTitle}>{event}</span>
          <span className={styles.expanderMeta}>
            {FORMATS[tournament.format].label} · {tournament.date} · {tournament.teams.length} players
          </span>
        </span>
        <span className={styles.expanderSide}>
          {champ ? `Champion: ${champ.name}` : tournament.status === "complete" ? "Complete" : "In progress"}
        </span>
      </button>
      {open && <TournamentResults tournament={tournament} />}
    </li>
  );
}

function GameSection({ group, open, onToggle, query }) {
  const gameMatches = !query || includes(group.name, query);
  const tournaments = gameMatches
    ? group.tournaments
    : group.tournaments.filter(
        (t) => includes(t.name, query) || t.teams.some((team) => includes(team.name, query))
      );
  const allRows = buildLeaderboard(group.tournaments);
  const rows = gameMatches ? allRows : allRows.filter((r) => includes(r.name, query));
  const players = allRows.length;

  return (
    <section className={styles.game}>
      <button type="button" className={styles.gameHeader} aria-expanded={open} onClick={onToggle}>
        <Chevron open={open} />
        <span className={styles.gameName}>{group.name}</span>
        <span className={styles.expanderMeta}>
          {group.tournaments.length} tournament{group.tournaments.length === 1 ? "" : "s"} · {players} player
          {players === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div className={styles.gameBody}>
          <h3>Leaderboard</h3>
          <LeaderboardTable rows={rows} />
          <h3>Tournaments</h3>
          <ul className={styles.tournamentList}>
            {tournaments.map((t) => (
              <TournamentRow key={t.id} tournament={t} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Overall player list, like the original Stats design. Admins can rename
// or delete a player from here.
function PlayerRow({ player, isAdmin }) {
  const { renamePlayerEverywhere, removePlayerEverywhere } = useTournaments();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(player.name);
  const [message, setMessage] = useState("");

  function saveName() {
    const problem = renamePlayerEverywhere(player.name, draft);
    setMessage(problem || "");
    if (!problem) setRenaming(false);
  }

  function remove() {
    if (!window.confirm(`Delete ${player.name} from every tournament they're in?`)) return;
    setMessage(removePlayerEverywhere(player.name) || "");
  }

  return (
    <li className={styles.playerItem}>
      <button type="button" className={styles.row} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <span className={styles.position}>{player.position}</span>
          {player.name}
        </span>
        <span>
          {player.wins} win{player.wins === 1 ? "" : "s"} · {player.losses} loss{player.losses === 1 ? "" : "es"}
        </span>
      </button>
      {open && (
        <div className={styles.history}>
          <p className={styles.historySummary}>
            {player.events} event{player.events === 1 ? "" : "s"} · {winRate(player)} win rate · {player.titles} title
            {player.titles === 1 ? "" : "s"}
          </p>
          {player.history.length === 0 && <p className={styles.muted}>No matches played yet.</p>}
          {player.history.map((h, i) => (
            <div key={i} className={styles.historyRow}>
              <Link to={`/tournament/${h.tournamentId}`}>{h.tournament}</Link>
              <span>vs {h.opponent}</span>
              <span>
                {h.result} {h.score}
              </span>
            </div>
          ))}
          {isAdmin && (
            <div className={styles.adminRow}>
              {renaming ? (
                <>
                  <input
                    aria-label={`New name for ${player.name}`}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                  />
                  <button type="button" onClick={saveName}>
                    Save
                  </button>
                  <button type="button" onClick={() => setRenaming(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setRenaming(true)}>
                    Rename
                  </button>
                  <button type="button" className={styles.dangerBtn} onClick={remove}>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
          {message && <p className={styles.error}>{message}</p>}
        </div>
      )}
    </li>
  );
}

export default function StatsPage() {
  const { tournaments } = useTournaments();
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";
  const [search, setSearch] = useState("");
  // Opened games when not searching; closed games while searching (search
  // opens every matching game by default).
  const [openGames, setOpenGames] = useState(() => new Set());
  const [closedWhileSearching, setClosedWhileSearching] = useState(() => new Set());
  const query = search.trim().toLowerCase();

  const groups = groupByGame(tournaments).filter(
    (g) =>
      !query ||
      includes(g.name, query) ||
      g.tournaments.some((t) => includes(t.name, query) || t.teams.some((team) => includes(team.name, query)))
  );
  const players = buildLeaderboard(tournaments).filter((p) => !query || includes(p.name, query));

  const isOpen = (key) => (query ? !closedWhileSearching.has(key) : openGames.has(key));
  function toggle(key) {
    const flip = (set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    };
    if (query) setClosedWhileSearching(flip);
    else setOpenGames(flip);
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <BackLink />
        <div className={styles.titleRow}>
          <h1>Stats</h1>
          <input
            type="search"
            className={styles.search}
            placeholder="Search games, events, players…"
            aria-label="Search stats"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setClosedWhileSearching(new Set());
            }}
          />
        </div>

        <div className={styles.columns}>
          <div className={styles.gamesCol}>
            <h2>Games</h2>
            {groups.length === 0 && <p className={styles.muted}>{query ? "No games match." : "No games yet."}</p>}
            {groups.map((g) => (
              <GameSection key={g.key} group={g} open={isOpen(g.key)} onToggle={() => toggle(g.key)} query={query} />
            ))}
          </div>
          <div className={styles.playersCol}>
            <h2>Players</h2>
            {players.length === 0 && <p className={styles.muted}>{query ? "No players match." : "No players yet."}</p>}
            <ul className={styles.playerList}>
              {players.map((p) => (
                <PlayerRow key={p.key} player={p} isAdmin={isAdmin} />
              ))}
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
