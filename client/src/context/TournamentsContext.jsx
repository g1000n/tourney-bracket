// client/src/context/TournamentsContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
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
const STORAGE_KEY = "tb_tournaments";

// Tournaments saved before formats existed kept full match objects inside
// `rounds` as a second copy of `allMatches`. After a reload those copies
// drifted apart, so results never showed. `allMatches` is the copy that
// actually received results, so rebuild `rounds` from its ids.
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
    format: t.format || "single_elimination",
    bestOf: t.bestOf ?? null,
    options: t.options || { thirdPlace: t.allMatches.some((m) => m.isThirdPlace), random: false },
    rounds,
    allMatches,
    status: isComplete(allMatches) ? "complete" : "in_progress",
  };
}

function withStatus(t) {
  return { ...t, status: isComplete(t.allMatches) ? "complete" : "in_progress" };
}

// Builds a fresh bracket for a tournament's current players, keeping its
// format and settings. Used when a player is removed before play starts.
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

function renameInTournament(t, teamId, name) {
  const rename = (team) => (team && team.id === teamId ? { ...team, name } : team);
  return {
    ...t,
    teams: t.teams.map(rename),
    allMatches: t.allMatches.map((m) => ({ ...m, teamA: rename(m.teamA), teamB: rename(m.teamB) })),
  };
}

export function TournamentsProvider({ children }) {
  const [tournaments, setTournaments] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(normalize);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  }, [tournaments]);

  const find = (id) => tournaments.find((t) => t.id === id);
  const replace = (next) => setTournaments((prev) => prev.map((t) => (t.id === next.id ? next : t)));

  // Runs `change` on a deep copy of one tournament. Returns an error
  // message, or null on success. Working on a copy keeps React state pure.
  function edit(tournamentId, change) {
    const current = find(tournamentId);
    if (!current) return "Tournament not found.";
    const copy = structuredClone(current);
    try {
      change(copy);
    } catch (e) {
      return e.message;
    }
    replace(withStatus(copy));
    return null;
  }

  function createTournament({
    game,
    roundName,
    players,
    format = "single_elimination",
    thirdPlace = true,
    random = true,
    bestOf = null,
    lateBestOf = bestOf,
  }) {
    const teams = players.map((p) => ({ id: crypto.randomUUID(), ...p }));
    const options = { thirdPlace: format === "single_elimination" && thirdPlace, random, lateBestOf };
    const { rounds, allMatches } = generateTournament(format, teams, { ...options, bestOf });
    const tournament = withStatus({
      id: crypto.randomUUID(),
      name: roundName ? `${game} — ${roundName}` : game,
      game,
      roundName: roundName || "",
      format,
      bestOf,
      options,
      date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      teams,
      rounds,
      allMatches,
    });
    setTournaments((prev) => [...prev, tournament]);
    return tournament.id;
  }

  // Live scoring: every +/− is saved immediately, so later these can be
  // pushed to viewers in real time.
  function setLiveScore(tournamentId, matchId, scoreA, scoreB) {
    return edit(tournamentId, (t) => {
      const match = t.allMatches.find((m) => m.id === matchId);
      if (!match || !isReady(match)) throw new Error("This match can't be scored right now.");
      const problem = validateLiveScore(scoreA, scoreB, matchBestOf(t, matchId));
      if (problem) throw new Error(problem);
      match.scoreA = scoreA;
      match.scoreB = scoreB;
    });
  }

  function finishMatch(tournamentId, matchId) {
    return edit(tournamentId, (t) => {
      const match = t.allMatches.find((m) => m.id === matchId);
      submitResult(t.allMatches, match, match.scoreA ?? 0, match.scoreB ?? 0, { bestOf: matchBestOf(t, matchId) });
    });
  }

  function reopenMatch(tournamentId, matchId) {
    return edit(tournamentId, (t) => {
      undoResult(t.allMatches, t.allMatches.find((m) => m.id === matchId));
    });
  }

  function setRoundBestOf(tournamentId, roundIndex, bestOf) {
    return edit(tournamentId, (t) => {
      const round = t.rounds[roundIndex];
      if (roundMatches(t, round).some((m) => hasStarted(m) || (m.winnerId && !m.isBye))) {
        throw new Error("This round has already started, so its match length is locked.");
      }
      round.bestOf = bestOf;
    });
  }

  function deleteTournament(tournamentId) {
    setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
  }

  function renamePlayer(tournamentId, teamId, newName) {
    const name = newName.trim();
    const t = find(tournamentId);
    if (!name) return "Enter a name.";
    if (t.teams.some((team) => team.id !== teamId && team.name.toLowerCase() === name.toLowerCase())) {
      return "Another player in this tournament already has that name.";
    }
    replace(renameInTournament(t, teamId, name));
    return null;
  }

  // Players are matched across tournaments by name, so this renames the
  // player everywhere they appear.
  function renamePlayerEverywhere(oldName, newName) {
    const name = newName.trim();
    if (!name) return "Enter a name.";
    const key = oldName.toLowerCase();
    const clash = tournaments.find(
      (t) =>
        t.teams.some((team) => team.name.toLowerCase() === key) &&
        t.teams.some((team) => team.name.toLowerCase() === name.toLowerCase() && team.name.toLowerCase() !== key)
    );
    if (clash) return `"${name}" is already a different player in ${clash.name}.`;
    setTournaments((prev) =>
      prev.map((t) => {
        const team = t.teams.find((x) => x.name.toLowerCase() === key);
        return team ? renameInTournament(t, team.id, name) : t;
      })
    );
    return null;
  }

  function removalProblem(t, teamId) {
    if (hasResults(t)) return `${t.name} has already started, so players can't be removed from it.`;
    const remaining = t.teams.filter((team) => team.id !== teamId);
    if (remaining.length < 2) return `${t.name} needs at least 2 players.`;
    if (t.options.thirdPlace && remaining.length < 4) return `${t.name} has a 3rd-place match, which needs 4+ players.`;
    return null;
  }

  // Only before any match is played: the bracket is rebuilt without them.
  function removePlayer(tournamentId, teamId) {
    const t = find(tournamentId);
    const problem = removalProblem(t, teamId);
    if (problem) return problem;
    replace(regenerate(t, t.teams.filter((team) => team.id !== teamId)));
    return null;
  }

  function removePlayerEverywhere(name) {
    const key = name.toLowerCase();
    const affected = tournaments
      .map((t) => ({ t, team: t.teams.find((x) => x.name.toLowerCase() === key) }))
      .filter((x) => x.team);
    const problems = affected.map(({ t, team }) => removalProblem(t, team.id)).filter(Boolean);
    if (problems.length) return problems.join(" ");
    const rebuilt = new Map(affected.map(({ t, team }) => [t.id, regenerate(t, t.teams.filter((x) => x !== team))]));
    setTournaments((prev) => prev.map((t) => rebuilt.get(t.id) || t));
    return null;
  }

  return (
    <TournamentsContext.Provider
      value={{
        tournaments,
        createTournament,
        setLiveScore,
        finishMatch,
        reopenMatch,
        setRoundBestOf,
        deleteTournament,
        renamePlayer,
        renamePlayerEverywhere,
        removePlayer,
        removePlayerEverywhere,
      }}
    >
      {children}
    </TournamentsContext.Provider>
  );
}

export function useTournaments() {
  return useContext(TournamentsContext);
}
