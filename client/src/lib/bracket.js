export function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function seedOrder(size) {
  if (size === 1) return [0];
  const prev = seedOrder(size / 2);
  const out = [];
  prev.forEach((s) => {
    out.push(s);
    out.push(size - 1 - s);
  });
  return out;
}

export function roundLabel(numMatches) {
  if (numMatches === 1) return "Final";
  if (numMatches === 2) return "Semifinals";
  if (numMatches === 4) return "Quarterfinals";
  return `Round of ${numMatches * 2}`;
}

// A match is only a real "bye" when exactly one side is known and the
// other genuinely has no opponent (uneven player count). Both sides
// empty means "waiting on a previous match", not a bye — that
// distinction is the whole fix.
function makeMatch(round, teamA, teamB) {
  const isBye = (teamA && !teamB) || (!teamA && teamB);
  const match = {
    id: crypto.randomUUID(),
    round,
    teamA: teamA || null,
    teamB: teamB || null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    nextMatchId: null,
    nextSlot: null,
    isBye,
  };
  if (isBye) {
    const realTeam = teamA || teamB;
    match.winnerId = realTeam.id;
  }
  return match;
}

export function generateBracket(teams) {
  const n = teams.length;
  if (n < 2) throw new Error("Need at least 2 players to generate a bracket.");

  const sorted = [...teams].sort((a, b) => {
    const ra = a.rank == null ? Infinity : a.rank;
    const rb = b.rank == null ? Infinity : b.rank;
    return ra - rb;
  });

  const P = nextPowerOf2(n);
  const order = seedOrder(P);
  const round1Entrants = order.map((seedRank) => (seedRank < n ? sorted[seedRank] : null));

  const rounds = [];
  let entrants = round1Entrants;
  let roundNum = 0;
  let allMatches = [];

  while (entrants.length >= 1) {
    const matches = [];
    for (let i = 0; i < entrants.length; i += 2) {
      matches.push(makeMatch(roundNum, entrants[i], entrants[i + 1]));
    }
    rounds.push({ label: roundLabel(matches.length), matches });
    allMatches = allMatches.concat(matches);

    if (matches.length === 1) break;

    // Every later round starts as empty shells. They get filled in only
    // when the real previous-round matches are actually played.
    entrants = matches.map(() => null);
    roundNum++;
  }

  for (let r = 0; r < rounds.length - 1; r++) {
    const current = rounds[r].matches;
    const next = rounds[r + 1].matches;
    current.forEach((m, i) => {
      m.nextMatchId = next[Math.floor(i / 2)].id;
      m.nextSlot = i % 2 === 0 ? "A" : "B";
    });
  }

  // Byes decided at generation time (round 1 only) propagate immediately.
  allMatches.forEach((m) => {
    if (m.winnerId && m.nextMatchId) {
      const next = allMatches.find((x) => x.id === m.nextMatchId);
      const winnerTeam = m.teamA && m.teamA.id === m.winnerId ? m.teamA : m.teamB;
      if (m.nextSlot === "A") next.teamA = winnerTeam;
      else next.teamB = winnerTeam;
    }
  });

  return { rounds, allMatches };
}

export function findMatch(allMatches, matchId) {
  return allMatches.find((m) => m.id === matchId);
}

export function submitResult(allMatches, match, scoreA, scoreB) {
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerId = scoreA > scoreB ? match.teamA.id : match.teamB.id;
  if (match.nextMatchId) {
    const next = findMatch(allMatches, match.nextMatchId);
    const winnerTeam = scoreA > scoreB ? match.teamA : match.teamB;
    if (match.nextSlot === "A") next.teamA = winnerTeam;
    else next.teamB = winnerTeam;
  }
}