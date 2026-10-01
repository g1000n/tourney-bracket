import { nextPowerOf2, seedOrder, seedTeams, makeMatch, feedWinner, feedLoser, resolveByes } from "./bracketCore.js";

export function roundLabel(numMatches) {
  if (numMatches === 1) return "Final";
  if (numMatches === 2) return "Semifinals";
  if (numMatches === 4) return "Quarterfinals";
  return `Round of ${numMatches * 2}`;
}

// Builds a full power-of-two bracket seeded 1 vs N, 2 vs N-1, and so on.
// Byes only ever land in round 1. Every later round starts as empty shells
// that fill in as real results arrive.
export function buildEliminationTree(seeded, { codePrefix, bracketSide = null, labelPrefix = "" }) {
  const n = seeded.length;
  const P = nextPowerOf2(n);
  const order = seedOrder(P);
  const treeRounds = [];
  let prev = null;

  for (let count = P / 2, r = 0; count >= 1; count /= 2, r++) {
    const matches = [];
    for (let i = 0; i < count; i++) {
      const m = makeMatch({ round: r, code: `${codePrefix}${r + 1}-${i + 1}`, bracketSide });
      if (r === 0) {
        m.teamA = seeded[order[2 * i]] ?? null;
        m.teamB = seeded[order[2 * i + 1]] ?? null;
      } else {
        feedWinner(prev[2 * i], m, "A");
        feedWinner(prev[2 * i + 1], m, "B");
      }
      matches.push(m);
    }
    treeRounds.push({ label: `${labelPrefix}${roundLabel(count)}`, matches });
    prev = matches;
  }
  return treeRounds;
}

export function generateSingleElimination(teams, { thirdPlace = true, random = false } = {}) {
  if (teams.length < 2) throw new Error("Need at least 2 players to generate a bracket.");
  if (thirdPlace && teams.length < 4) {
    throw new Error("A 3rd-place match needs at least 4 players. Add more players or untick the 3rd-place option.");
  }
  const seeded = seedTeams(teams, { random });
  const treeRounds = buildEliminationTree(seeded, { codePrefix: "R" });
  const allMatches = treeRounds.flatMap((r) => r.matches);
  const rounds = treeRounds.map((r) => ({ label: r.label, side: null, matchIds: r.matches.map((m) => m.id) }));

  // With 4+ players both semifinals are always real matches (standard
  // seeding never puts two byes against each other), so both have a
  // genuine loser to send here.
  if (thirdPlace) {
    const semis = treeRounds[treeRounds.length - 2].matches;
    const tp = makeMatch({ round: treeRounds.length - 1, code: "3P", bracketSide: "third_place" });
    tp.isThirdPlace = true;
    feedLoser(semis[0], tp, "A");
    feedLoser(semis[1], tp, "B");
    allMatches.push(tp);
    rounds.push({ label: "3rd place", side: "third_place", matchIds: [tp.id] });
  }

  resolveByes(allMatches);
  return { rounds, allMatches };
}
