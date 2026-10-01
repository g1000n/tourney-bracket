import { seedTeams, makeMatch, feedWinner, feedLoser, resolveByes } from "./bracketCore.js";
import { buildEliminationTree } from "./singleElimination.js";

// Orders in which a winners-bracket round's losers can drop into the
// losers bracket. The order matters: drop them in naively and a player
// can meet someone they already beat within a round or two.
const DROP_ORDERS = {
  natural: (n) => [...Array(n).keys()],
  reverse: (n) => [...Array(n).keys()].reverse(),
  halfShift: (n) => [...Array(n).keys()].map((i) => (i + Math.floor(n / 2)) % n),
  reverseHalfShift: (n) => [...Array(n).keys()].reverse().map((i) => (i + Math.floor(n / 2)) % n),
  pairFlip: (n) => [...Array(n).keys()].map((i) => (n === 1 ? 0 : i ^ 1)),
};

function overlaps(a, b) {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

// Losers bracket shape for a winners bracket with k rounds (k >= 2):
//   LB round 1         — WB round 1 losers paired up
//   then, for each later WB round r:
//     "major" round    — LB survivors vs WB round r losers dropping in
//     "minor" round    — LB survivors paired up (skipped once only one is left)
// That's 2(k-1) losers rounds. The last one is the losers final; the one
// before it is the losers semifinal.
//
// `origins` tracks which WB round-1 matches each match's players could have
// come from. A WB round-r loser has only ever played people from its own
// block of round-1 matches, so a drop order is rematch-free when no LB
// survivor could come from the same block as the loser it's paired with.
// Each round picks the first order in DROP_ORDERS with no such overlap
// (or the fewest, if none is clean).
//
// Verified by simulating thousands of random brackets: up to 8 players, no
// two players ever meet twice before the losers semifinal. From 16 players
// up that guarantee is impossible with this bracket shape (keeping LB round
// 4 clean forces a possible rematch in LB round 3, and vice versa), so early
// rematches are kept rare rather than ruled out — about 1 bracket in 4-5
// with random results, the same as the best fixed orders we could find.
export function generateDoubleElimination(teams, { random = false } = {}) {
  if (teams.length < 2) throw new Error("Need at least 2 players to generate a bracket.");
  const seeded = seedTeams(teams, { random });
  const wbTree = buildEliminationTree(seeded, { codePrefix: "W", bracketSide: "winners", labelPrefix: "Winners " });
  const wb = wbTree.map((r) => r.matches);
  const k = wb.length;

  const origins = new Map();
  wb[0].forEach((m, i) => origins.set(m.id, new Set([i])));
  for (let r = 1; r < k; r++) {
    wb[r].forEach((m, j) => {
      origins.set(m.id, new Set([...origins.get(wb[r - 1][2 * j].id), ...origins.get(wb[r - 1][2 * j + 1].id)]));
    });
  }
  const union = (...ms) => new Set(ms.flatMap((m) => [...origins.get(m.id)]));

  const lb = [];
  const lbLabels = [];
  let lbRound = 0;
  const newLbMatch = (i) => makeMatch({ round: lbRound, code: `L${lbRound + 1}-${i + 1}`, bracketSide: "losers" });

  if (k >= 2) {
    const first = wb[0].slice(0, wb[0].length / 2).map((_, i) => {
      const m = newLbMatch(i);
      feedLoser(wb[0][2 * i], m, "A");
      feedLoser(wb[0][2 * i + 1], m, "B");
      origins.set(m.id, union(wb[0][2 * i], wb[0][2 * i + 1]));
      return m;
    });
    lb.push(first);
    lbRound++;

    for (let r = 1; r < k; r++) {
      const survivors = lb[lb.length - 1];
      const dropping = wb[r];

      let best = null;
      for (const makeOrder of Object.values(DROP_ORDERS)) {
        const order = makeOrder(dropping.length);
        const conflicts = order.filter((p, i) => overlaps(origins.get(survivors[i].id), origins.get(dropping[p].id))).length;
        if (!best || conflicts < best.conflicts) best = { order, conflicts };
        if (conflicts === 0) break;
      }

      const major = survivors.map((s, i) => {
        const m = newLbMatch(i);
        feedWinner(s, m, "A");
        feedLoser(dropping[best.order[i]], m, "B");
        origins.set(m.id, union(s, dropping[best.order[i]]));
        return m;
      });
      lb.push(major);
      lbRound++;

      if (major.length > 1) {
        const minor = major.slice(0, major.length / 2).map((_, i) => {
          const m = newLbMatch(i);
          feedWinner(major[2 * i], m, "A");
          feedWinner(major[2 * i + 1], m, "B");
          origins.set(m.id, union(major[2 * i], major[2 * i + 1]));
          return m;
        });
        lb.push(minor);
        lbRound++;
      }
    }
    lb.forEach((round, i) => {
      if (i === lb.length - 1) lbLabels.push("Losers Final");
      else if (i === lb.length - 2) lbLabels.push("Losers Semifinal");
      else lbLabels.push(`Losers Round ${i + 1}`);
    });
  }

  const wbFinal = wb[k - 1][0];
  const grandFinal = makeMatch({ round: 0, code: "GF", bracketSide: "final" });
  grandFinal.isGrandFinal = true;
  feedWinner(wbFinal, grandFinal, "A");
  if (lb.length) feedWinner(lb[lb.length - 1][0], grandFinal, "B");
  else feedLoser(wbFinal, grandFinal, "B"); // 2 players: the loser drops straight to the grand final

  const reset = makeMatch({ round: 1, code: "GF2", bracketSide: "final" });
  reset.isReset = true;

  const allMatches = [...wb.flat(), ...lb.flat(), grandFinal, reset];
  const rounds = [
    ...wbTree.map((r) => ({ label: r.label, side: "winners", matchIds: r.matches.map((m) => m.id) })),
    ...lb.map((matches, i) => ({ label: lbLabels[i], side: "losers", matchIds: matches.map((m) => m.id) })),
    { label: "Grand Final", side: "final", matchIds: [grandFinal.id] },
    { label: "Grand Final Reset", side: "final", matchIds: [reset.id] },
  ];

  resolveByes(allMatches);
  return { rounds, allMatches };
}
