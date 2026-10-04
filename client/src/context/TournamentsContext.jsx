// client/src/context/TournamentsContext.jsx
//
// The app's data layer. Bracket logic runs here in the browser
// (lib/bracket.js); every change is then saved through the API layer
// (api/index.js), which is either the Express server or the browser-only
// demo. Pages only use the functions exposed at the bottom.
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as api from "../api";
import {
  generateTournament,
  submitResult,
  reopenMatch as undoResult,
  isComplete,
  isReady,
  hasStarted,
  hasResults,
  matchBestOf,
  validateLiveScore,
  roundMatches,
} from "../lib/bracket";

const TournamentsContext = createContext(null);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Fills in anything older saved data lacks. Tournaments saved before formats
// existed kept full match objects inside `rounds` as a second copy of
// `allMatches`; rebuild `rounds` from ids, since `allMatches` is the copy
// that actually received results.
function normalize(t) {
  const rounds = t.rounds.map((r) =>
    r.matchIds ? r : { label: r.label, side: null, matchIds: r.matches.map((m) => m.id) }
  );
  const allMatches = t.allMatches.map((m) => ({
    loserNextMatchId: null,
    loserNextSlot: null,
    isVoid: false,
    isThirdPlace: false,
    isGrandFinal: false,
    isReset: false,
    bracketSide: null,
    code: `R${m.round + 1}`,
    ...m,
  }));
  return {
    ...t,
    name: t.name || (t.roundName ? `${t.game} — ${t.roundName}` : t.game),
    roundName: t.roundName ?? "",
    format: t.format || "single_elimination",
    bestOf: t.bestOf ?? null,
    options: { thirdPlace: allMatches.some((m) => m.isThirdPlace), random: false, ...t.options },
    date: t.createdAt ? formatDate(t.createdAt) : t.date,
    rounds,
    allMatches,
    status: isComplete(allMatches) ? "complete" : "in_progress",
  };
}

function withStatus(t) {
  return { ...t, status: isComplete(t.allMatches) ? "complete" : "in_progress" };
}

// A fresh bracket for a tournament's current players, keeping its format
// and settings. Used when a player is removed before play starts.
function regenerate(t, currentTeams) {
  // Copies, because seeding writes each player's new seed onto them.
  const teams = currentTeams.map((team) => ({ ...team }));
  const { rounds, allMatches } = generateTournament(t.format, teams, {
    ...t.options,
    bestOf: t.bestOf,
    lateBestOf: t.options.lateBestOf === undefined ? t.bestOf : t.options.lateBestOf,
  });
  return withStatus({ ...t, teams, rounds, allMatches });
}

function removalProblem(t, teamId) {
  if (hasResults(t)) return `${t.name} has already started, so players can't be removed from it.`;
  const remaining = t.teams.filter((team) => team.id !== teamId);
  if (remaining.length < 2) return `${t.name} needs at least 2 players.`;
  if (t.options.thirdPlace && remaining.length < 4) return `${t.name} has a 3rd-place match, which needs 4+ players.`;
  return null;
}

export function TournamentsProvider({ children }) {
  const [tournaments, setTournamentsState] = useState([]);
  const [apiPlayers, setApiPlayers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Always-current copy of the list, so quick clicks in a row each build on
  // the previous click instead of on a stale render.
  const current = useRef([]);
  const setAll = (next) => {
    current.current = next;
    setTournamentsState(next);
  };

  // Saves go out one at a time, in click order, so a later score can never
  // be overwritten by an earlier request that arrived late.
  const queue = useRef(Promise.resolve());
  // Saves still on their way. A live update that arrives meanwhile waits
  // until they're done, so it can't briefly undo what's on screen.
  const pending = useRef(0);
  const staleWhileSaving = useRef(false);
  const enqueue = (task) => {
    pending.current++;
    const run = queue.current.then(task).finally(() => {
      pending.current--;
      if (pending.current === 0 && staleWhileSaving.current) {
        staleWhileSaving.current = false;
        reload();
      }
    });
    queue.current = run.catch(() => {});
    return run;
  };

  const reload = useCallback(async () => {
    try {
      const list = await api.listTournaments();
      setAll(list.map(normalize));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    }
    try {
      setApiPlayers(await api.listPlayers());
    } catch {
      // The player API isn't required; players are also found in tournaments.
      setApiPlayers(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Live updates: when someone else changes something, reload (at most a few
  // times a second, however many changes arrive).
  useEffect(() => {
    let timer = null;
    const unsubscribe = api.subscribe(() => {
      if (pending.current > 0) {
        staleWhileSaving.current = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(reload, 250);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [reload]);

  // Everyone who has played, from the player API when it's available,
  // otherwise from the tournaments themselves. One entry per name.
  const players = useMemo(() => {
    const byName = new Map();
    for (const p of apiPlayers || []) byName.set(p.name.toLowerCase(), { id: p.id, name: p.name });
    for (const t of tournaments) {
      for (const team of t.teams) {
        const key = team.name.toLowerCase();
        if (!byName.has(key)) byName.set(key, { id: team.id, name: team.name });
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [apiPlayers, tournaments]);

  // Every game played so far (one per name, ignoring capitals), most
  // recently played first.
  const games = useMemo(() => {
    const byName = new Map();
    const newestFirst = [...tournaments].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    for (const t of newestFirst) {
      const key = t.game.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: t.game.trim(), count: 0 });
      byName.get(key).count++;
    }
    return [...byName.values()];
  }, [tournaments]);

  // The seed each player was last given in this game, so a new tournament
  // of the same game starts with the same seeds. Map(lowercase name -> rank).
  const savedSeeds = useCallback(
    (game) => {
      const key = game.trim().toLowerCase();
      const seeds = new Map();
      const sameGame = tournaments
        .filter((t) => t.game.trim().toLowerCase() === key)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      for (const t of sameGame) {
        for (const team of t.teams) {
          const name = team.name.toLowerCase();
          if (team.rank != null && !seeds.has(name)) seeds.set(name, team.rank);
        }
      }
      return seeds;
    },
    [tournaments]
  );

  const find = (id) => current.current.find((t) => t.id === id);
  const replace = (next) => setAll(current.current.map((t) => (t.id === next.id ? next : t)));

  // Applies a change to one tournament's matches right away (so the screen
  // updates instantly), then saves just the matches that changed. If the
  // save fails, the data is reloaded from the server and the error returned.
  async function editMatches(tournamentId, change) {
    const before = find(tournamentId);
    if (!before) return "Tournament not found.";
    const draft = structuredClone(before);
    let roundChanges;
    try {
      roundChanges = change(draft) || [];
    } catch (e) {
      return e.message;
    }
    const next = withStatus(draft);
    const matches = next.allMatches.filter((m, i) => JSON.stringify(m) !== JSON.stringify(before.allMatches[i]));
    replace(next);
    try {
      await enqueue(() => api.updateTournament(next, { status: next.status, matches, rounds: roundChanges }));
      return null;
    } catch (e) {
      await reload();
      return e.message;
    }
  }

  async function createTournament({
    game,
    roundName,
    players: entrants,
    format = "single_elimination",
    thirdPlace = true,
    random = true,
    bestOf = null,
    lateBestOf = bestOf,
  }) {
    // Reuse known players' ids, so the same person keeps one history.
    const known = new Map(players.map((p) => [p.name.toLowerCase(), p.id]));
    const teams = entrants.map((p) => ({ id: known.get(p.name.toLowerCase()) || crypto.randomUUID(), ...p }));
    const options = { thirdPlace: format === "single_elimination" && thirdPlace, random, lateBestOf };
    const { rounds, allMatches } = generateTournament(format, teams, { ...options, bestOf });
    const tournament = withStatus({
      id: crypto.randomUUID(),
      game,
      roundName: roundName || "",
      name: roundName ? `${game} — ${roundName}` : game,
      format,
      bestOf,
      options,
      createdAt: new Date().toISOString(),
      teams,
      rounds,
      allMatches,
    });
    const saved = normalize(await api.createTournament(tournament));
    setAll([saved, ...current.current]);
    return saved.id;
  }

  // Live scoring: every +/− is saved immediately, so viewers can later be
  // shown scores as they happen.
  const setLiveScore = (tournamentId, matchId, scoreA, scoreB) =>
    editMatches(tournamentId, (t) => {
      const match = t.allMatches.find((m) => m.id === matchId);
      if (!match || !isReady(match)) throw new Error("This match can't be scored right now.");
      const problem = validateLiveScore(scoreA, scoreB, matchBestOf(t, matchId));
      if (problem) throw new Error(problem);
      match.scoreA = scoreA;
      match.scoreB = scoreB;
    });

  const finishMatch = (tournamentId, matchId) =>
    editMatches(tournamentId, (t) => {
      const match = t.allMatches.find((m) => m.id === matchId);
      submitResult(t.allMatches, match, match.scoreA ?? 0, match.scoreB ?? 0, { bestOf: matchBestOf(t, matchId) });
    });

  const reopenMatch = (tournamentId, matchId) =>
    editMatches(tournamentId, (t) => {
      undoResult(t.allMatches, t.allMatches.find((m) => m.id === matchId));
    });

  const setRoundBestOf = (tournamentId, roundIndex, bestOf) =>
    editMatches(tournamentId, (t) => {
      const round = t.rounds[roundIndex];
      if (roundMatches(t, round).some((m) => hasStarted(m) || (m.winnerId && !m.isBye))) {
        throw new Error("This round has already started, so its match length is locked.");
      }
      round.bestOf = bestOf;
      return [{ index: roundIndex, bestOf }];
    });

  async function deleteTournament(tournamentId) {
    setAll(current.current.filter((t) => t.id !== tournamentId));
    try {
      await enqueue(() => api.deleteTournament(tournamentId));
      return null;
    } catch (e) {
      await reload();
      return e.message;
    }
  }

  // Players are one record across every tournament, so a rename shows
  // everywhere.
  async function renamePlayer(oldName, newName) {
    const name = newName.trim();
    if (!name) return "Enter a name.";
    if (name.length > 100) return "Names can be at most 100 characters.";
    const player = players.find((p) => p.name.toLowerCase() === oldName.toLowerCase());
    if (!player) return "Player not found.";
    if (players.some((p) => p !== player && p.name.toLowerCase() === name.toLowerCase())) {
      return `There's already a player called "${name}".`;
    }
    try {
      await enqueue(() => api.renamePlayer({ id: player.id, oldName, name }));
      await reload();
      return null;
    } catch (e) {
      return e.message;
    }
  }

  // Only before any match is played: the bracket is rebuilt without them.
  async function removePlayer(tournamentId, teamId) {
    const t = find(tournamentId);
    const problem = removalProblem(t, teamId);
    if (problem) return problem;
    try {
      const rebuilt = regenerate(t, t.teams.filter((team) => team.id !== teamId));
      replace(normalize(await enqueue(() => api.replaceTournament(rebuilt))));
      return null;
    } catch (e) {
      await reload();
      return e.message;
    }
  }

  // Removes the player from every tournament they're in (none may have
  // started), then deletes the player record.
  async function removePlayerEverywhere(name) {
    const key = name.toLowerCase();
    const affected = current.current
      .map((t) => ({ t, team: t.teams.find((x) => x.name.toLowerCase() === key) }))
      .filter((x) => x.team);
    const problems = affected.map(({ t, team }) => removalProblem(t, team.id)).filter(Boolean);
    if (problems.length) return problems.join(" ");
    const player = players.find((p) => p.name.toLowerCase() === key);
    try {
      for (const { t, team } of affected) {
        await enqueue(() => api.replaceTournament(regenerate(t, t.teams.filter((x) => x !== team))));
      }
      if (player) await enqueue(() => api.deletePlayer({ id: player.id, name: player.name }));
      await reload();
      return null;
    } catch (e) {
      await reload();
      return e.message;
    }
  }

  async function login(username, password) {
    const { token } = await api.login(username, password);
    sessionStorage.setItem(api.ADMIN_TOKEN_KEY, token);
    sessionStorage.setItem("isAdmin", "true");
  }

  function logout() {
    sessionStorage.removeItem(api.ADMIN_TOKEN_KEY);
    sessionStorage.removeItem("isAdmin");
  }

  return (
    <TournamentsContext.Provider
      value={{
        tournaments,
        players,
        games,
        savedSeeds,
        loading,
        loadError,
        reload,
        createTournament,
        setLiveScore,
        finishMatch,
        reopenMatch,
        setRoundBestOf,
        deleteTournament,
        renamePlayer,
        removePlayer,
        removePlayerEverywhere,
        login,
        logout,
      }}
    >
      {children}
    </TournamentsContext.Provider>
  );
}

export function useTournaments() {
  return useContext(TournamentsContext);
}
