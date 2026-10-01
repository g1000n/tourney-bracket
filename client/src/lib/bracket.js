// Single entry point for every tournament format. Pages import from here.
//
// Every format returns the same shape, { rounds, allMatches }:
//   allMatches — the flat list of match objects (the source of truth)
//   rounds     — [{ label, side, matchIds }], display grouping only
// Rounds hold ids, not match objects, so there is only ever one copy of
// each match. (Holding the objects in both places broke as soon as the
// data went through JSON: results landed in one copy and not the other.)

import { generateSingleElimination } from "./singleElimination.js";
import { generateDoubleElimination } from "./doubleElimination.js";
import { generateRoundRobin, computeStandings } from "./roundRobin.js";
import { findMatch, winnerOf, loserOf } from "./bracketCore.js";

export {
  nextPowerOf2,
  seedOrder,
  findMatch,
  submitResult,
  slotLabel,
  isComplete,
  isReady,
  isDecided,
  winsNeeded,
  seriesResults,
  validateScore,
  validateLiveScore,
  hasStarted,
  canReopen,
  reopenMatch,
} from "./bracketCore.js";

// null = free scoring. Otherwise a best-of-N series, first to ceil(N/2).
export const MATCH_LENGTHS = [
  { value: null, label: "Free score", description: "Enter any points total" },
  { value: 1, label: "Best of 1", description: "Single game" },
  { value: 3, label: "Best of 3", description: "First to 2" },
  { value: 5, label: "Best of 5", description: "First to 3" },
  { value: 7, label: "Best of 7", description: "First to 4" },
];
export { roundLabel } from "./singleElimination.js";
export { computeStandings } from "./roundRobin.js";

export const FORMATS = {
  single_elimination: {
    label: "Single elimination",
    description: "Lose once and you're out. Byes fill uneven player counts.",
    matchCount: (n) => n - 1,
  },
  double_elimination: {
    label: "Double elimination",
    description: "Lose twice to be knocked out. Losers drop into a second bracket.",
    // 2(n-1) matches, plus the grand final reset if it's needed.
    matchCount: (n) => 2 * (n - 1),
  },
  round_robin: {
    label: "Round robin",
    description: "Everyone plays everyone once. Most wins takes it.",
    matchCount: (n) => (n * (n - 1)) / 2,
  },
};

function generateFormat(format, teams, options) {
  switch (format) {
    case "single_elimination":
      return generateSingleElimination(teams, options);
    case "double_elimination":
      return generateDoubleElimination(teams, options);
    case "round_robin":
      return generateRoundRobin(teams, options);
    default:
      throw new Error(`Unknown tournament format: ${format}`);
  }
}

// options:
//   thirdPlace  — single elim only, needs 4+ players
//   random      — ignore ranks and shuffle the seeding
//   bestOf      — match length for every round (null = free score)
//   lateBestOf  — match length from the semifinals onward, for the
//                 elimination formats (defaults to bestOf)
export function generateTournament(format, teams, options = {}) {
  const result = generateFormat(format, teams, options);
  const bestOf = options.bestOf ?? null;
  const lateBestOf = options.lateBestOf === undefined ? bestOf : options.lateBestOf;
  result.rounds.forEach((round, i) => {
    round.bestOf = format !== "round_robin" && isLateRound(result.rounds, i) ? lateBestOf : bestOf;
  });
  return result;
}

// "Semifinals onward": the last two rounds of each bracket (winners,
// losers, or the single-elim bracket), plus the finals and 3rd-place match.
export function isLateRound(rounds, index) {
  const round = rounds[index];
  if (round.side === "final" || round.side === "third_place") return true;
  const sameSide = rounds.filter((r) => r.side === round.side);
  return sameSide.indexOf(round) >= sameSide.length - 2;
}

// The match length that applies to one match: its round's setting, or the
// tournament default for tournaments made before rounds had their own.
export function matchBestOf(tournament, matchId) {
  const round = tournament.rounds.find((r) => r.matchIds.includes(matchId));
  if (round && round.bestOf !== undefined) return round.bestOf;
  return tournament.bestOf ?? null;
}

export function matchLengthLabel(bestOf) {
  return MATCH_LENGTHS.find((l) => l.value === (bestOf ?? null))?.label ?? `Best of ${bestOf}`;
}

// True once any real result or live score exists.
export function hasResults(tournament) {
  return tournament.allMatches.some((m) => (m.winnerId && !m.isBye) || m.scoreA != null || m.scoreB != null);
}

// Kept for older imports.
export const generateBracket = generateSingleElimination;

export function roundMatches(tournament, round) {
  return round.matchIds.map((id) => findMatch(tournament.allMatches, id));
}

// Returns { first, second, third } teams (any may be null), or null while
// the tournament is still running.
export function podium(tournament) {
  if (tournament.status !== "complete") return null;
  const all = tournament.allMatches;

  if (tournament.format === "round_robin") {
    const table = computeStandings(tournament.teams, all);
    return { first: table[0]?.team ?? null, second: table[1]?.team ?? null, third: table[2]?.team ?? null };
  }

  if (tournament.format === "double_elimination") {
    const gf = all.find((m) => m.isGrandFinal);
    const reset = all.find((m) => m.isReset);
    const decider = reset && !reset.isVoid ? reset : gf;
    const lbFinal = all.find((m) => m.nextMatchId === gf.id && m.bracketSide === "losers");
    return {
      first: winnerOf(decider),
      second: loserOf(decider),
      third: lbFinal ? loserOf(lbFinal) : null,
    };
  }

  const final = all.find((m) => !m.nextMatchId && !m.isThirdPlace);
  const third = all.find((m) => m.isThirdPlace);
  return { first: winnerOf(final), second: loserOf(final), third: third ? winnerOf(third) : null };
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Where each player finished (or has got to so far) in one tournament.
// Returns Map(teamId -> { order, label }); lower `order` = better.
export function placements(tournament) {
  const result = new Map();
  const all = tournament.allMatches;
  const complete = tournament.status === "complete";

  if (tournament.format === "round_robin") {
    computeStandings(tournament.teams, all).forEach((row, i) => {
      result.set(row.team.id, { order: i, label: complete ? ordinal(i + 1) : `${ordinal(i + 1)} so far` });
    });
    return result;
  }

  // Elimination formats: find the match that knocked each player out.
  const roundIndex = (m) => tournament.rounds.findIndex((r) => r.matchIds.includes(m.id));
  const knockedOutIn = new Map();
  all.forEach((m) => {
    const loser = loserOf(m);
    if (!loser || m.isThirdPlace) return;
    if (tournament.format === "double_elimination") {
      // Only a loss in the losers bracket or finals eliminates, and the
      // winners-bracket champion losing the grand final forces a reset.
      if (m.bracketSide === "winners") return;
      if (m.isGrandFinal && loser.id === m.teamA.id) return;
    }
    knockedOutIn.set(loser.id, m);
  });

  tournament.teams.forEach((team) => {
    const m = knockedOutIn.get(team.id);
    if (!m) {
      result.set(team.id, { order: -1, label: complete ? "Champion" : "Still in" });
    } else {
      const i = roundIndex(m);
      result.set(team.id, { order: 1000 - i, label: `Out in ${tournament.rounds[i].label}` });
    }
  });

  const top = podium(tournament);
  if (top) {
    [top.first, top.second, top.third].forEach((team, i) => {
      if (team) result.set(team.id, { order: -10 + i, label: ["Champion", "2nd", "3rd"][i] });
    });
    const thirdPlace = all.find((m) => m.isThirdPlace);
    const fourth = thirdPlace && loserOf(thirdPlace);
    if (fourth) result.set(fourth.id, { order: -7, label: "4th" });
  }
  return result;
}
