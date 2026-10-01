import { seedTeams, makeMatch } from "./bracketCore.js";

// Every pair plays exactly once: n(n-1)/2 matches, scheduled into rounds
// with the circle method so nobody plays twice in the same round. With an
// odd player count, one player sits out each round.
export function generateRoundRobin(teams, { random = false } = {}) {
  if (teams.length < 2) throw new Error("Need at least 2 players for a round robin.");
  let list = seedTeams(teams, { random });
  if (list.length % 2 === 1) list.push(null);
  const size = list.length;

  const rounds = [];
  const allMatches = [];
  for (let r = 0; r < size - 1; r++) {
    const matches = [];
    for (let i = 0; i < size / 2; i++) {
      const a = list[i];
      const b = list[size - 1 - i];
      if (!a || !b) continue;
      matches.push(makeMatch({ round: r, code: `R${r + 1}-${matches.length + 1}`, teamA: a, teamB: b }));
    }
    rounds.push({ label: `Round ${r + 1}`, side: null, matchIds: matches.map((m) => m.id) });
    allMatches.push(...matches);
    // Keep the first entry fixed and rotate everyone else one step.
    list = [list[0], list[size - 1], ...list.slice(1, size - 1)];
  }
  return { rounds, allMatches };
}

// Wins first, then point difference, then original rank.
export function computeStandings(teams, allMatches) {
  const rows = new Map(
    teams.map((t) => [t.id, { team: t, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }])
  );
  allMatches.forEach((m) => {
    if (!m.winnerId || m.isBye || !m.teamA || !m.teamB) return;
    const a = rows.get(m.teamA.id);
    const b = rows.get(m.teamB.id);
    a.played++;
    b.played++;
    a.pointsFor += m.scoreA;
    a.pointsAgainst += m.scoreB;
    b.pointsFor += m.scoreB;
    b.pointsAgainst += m.scoreA;
    if (m.winnerId === m.teamA.id) {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }
  });
  const rankOf = (t) => (t.rank == null ? Infinity : t.rank);
  return [...rows.values()].sort(
    (x, y) =>
      y.wins - x.wins ||
      y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst) ||
      rankOf(x.team) - rankOf(y.team) ||
      x.team.name.localeCompare(y.team.name)
  );
}
