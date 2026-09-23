// client/src/context/TournamentsContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { generateBracket, submitResult as applyResult } from "../lib/bracket";

const TournamentsContext = createContext(null);
const STORAGE_KEY = "tb_tournaments";

export function TournamentsProvider({ children }) {
  const [tournaments, setTournaments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  }, [tournaments]);

  function createTournament({ game, roundName, players }) {
    const teams = players.map((p) => ({ id: crypto.randomUUID(), ...p }));
    const { rounds, allMatches } = generateBracket(teams);
    const tournament = {
      id: crypto.randomUUID(),
      name: roundName ? `${game} — ${roundName}` : game,
      game,
      date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      teams,
      rounds,
      allMatches,
      status: "in_progress",
    };
    setTournaments((prev) => [...prev, tournament]);
    return tournament.id;
  }

  function submitMatchResult(tournamentId, matchId, scoreA, scoreB) {
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== tournamentId) return t;
        const match = t.allMatches.find((m) => m.id === matchId);
        applyResult(t.allMatches, match, scoreA, scoreB);
        const finalMatch = t.rounds[t.rounds.length - 1].matches[0];
        const status = finalMatch.winnerId ? "complete" : "in_progress";
        return { ...t, status };
      })
    );
  }

  return (
    <TournamentsContext.Provider value={{ tournaments, createTournament, submitMatchResult }}>
      {children}
    </TournamentsContext.Provider>
  );
}

export function useTournaments() {
  return useContext(TournamentsContext);
}