// Shared engine for every tournament format.
//
// Every format produces the same thing: a flat list of match objects wired
// together by `nextMatchId`/`nextSlot` (where the winner goes) and
// `loserNextMatchId`/`loserNextSlot` (where the loser goes — used by the
// 3rd-place match and by the whole losers bracket in double elimination).
// One propagation mechanism serves all of them.

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

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Returns players in seed order (seed 1 first) and records each player's
// seed on `team.seed`. `rank` is only a seeding hint:
//   random: true  — ranks are ignored, everyone is shuffled
//   random: false — ranked players keep rank order, then the unranked
//                   players, shuffled among themselves
export function seedTeams(teams, { random = false } = {}) {
  const ranked = random ? [] : teams.filter((t) => t.rank != null).sort((a, b) => a.rank - b.rank);
  const rest = shuffle(random ? teams : teams.filter((t) => t.rank == null));
  const seeded = [...ranked, ...rest];
  seeded.forEach((t, i) => {
    t.seed = i + 1;
  });
  return seeded;
}

export function makeMatch({ round, code, bracketSide = null, teamA = null, teamB = null }) {
  return {
    id: crypto.randomUUID(),
    code,
    round,
    bracketSide,
    teamA,
    teamB,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    nextMatchId: null,
    nextSlot: null,
    loserNextMatchId: null,
    loserNextSlot: null,
    isBye: false,
    // Both sides turned out to be byes, so the match never happens.
    isVoid: false,
    isThirdPlace: false,
    isGrandFinal: false,
    isReset: false,
  };
}

export function feedWinner(from, to, slot) {
  from.nextMatchId = to.id;
  from.nextSlot = slot;
}

export function feedLoser(from, to, slot) {
  from.loserNextMatchId = to.id;
  from.loserNextSlot = slot;
}

export function findMatch(allMatches, matchId) {
  return allMatches.find((m) => m.id === matchId);
}

export function isDecided(match) {
  return Boolean(match.winnerId) || match.isVoid;
}

export function isReady(match) {
  return Boolean(match.teamA && match.teamB) && !isDecided(match);
}

export function winnerOf(match) {
  if (!match.winnerId) return null;
  return match.teamA?.id === match.winnerId ? match.teamA : match.teamB;
}

// A bye has a winner but no genuine loser.
export function loserOf(match) {
  if (!match.winnerId || match.isBye) return null;
  return match.teamA?.id === match.winnerId ? match.teamB : match.teamA;
}

function place(allMatches, matchId, slot, team) {
  const target = findMatch(allMatches, matchId);
  if (slot === "A") target.teamA = team;
  else target.teamB = team;
}

function slotSource(allMatches, match, slot) {
  const winnerFeeder = allMatches.find((m) => m.nextMatchId === match.id && m.nextSlot === slot);
  if (winnerFeeder) return { feeder: winnerFeeder, kind: "winner" };
  const loserFeeder = allMatches.find((m) => m.loserNextMatchId === match.id && m.loserNextSlot === slot);
  if (loserFeeder) return { feeder: loserFeeder, kind: "loser" };
  return null;
}

// "filled": a team is in the slot.
// "pending": a team will arrive once an earlier match is played.
// "dead": nobody will ever arrive (a genuine bye).
// Keeping "pending" and "dead" apart is the original bye fix: an undecided
// opponent is NOT a bye.
function slotState(allMatches, match, slot) {
  if (slot === "A" ? match.teamA : match.teamB) return "filled";
  if (match.isReset) return "pending";
  const source = slotSource(allMatches, match, slot);
  if (!source) return "dead";
  const { feeder, kind } = source;
  if (feeder.isVoid) return "dead";
  if (kind === "loser" && feeder.isBye) return "dead";
  return "pending";
}

function advance(allMatches, match) {
  const winner = winnerOf(match);
  const loser = loserOf(match);
  if (match.nextMatchId) place(allMatches, match.nextMatchId, match.nextSlot, winner);
  if (match.loserNextMatchId && loser) place(allMatches, match.loserNextMatchId, match.loserNextSlot, loser);

  // Grand final: slot A is the winners-bracket champion (no losses yet).
  // If they win, it's over. If the losers-bracket champion wins, both now
  // have one loss, so the reset match is played.
  if (match.isGrandFinal) {
    const reset = allMatches.find((m) => m.isReset);
    if (!reset) return;
    if (match.winnerId === match.teamA?.id) {
      reset.isVoid = true;
    } else {
      reset.teamA = match.teamA;
      reset.teamB = match.teamB;
    }
  }
}

// Settle every match whose outcome is already forced: byes advance their
// one real player, and matches with no possible players are voided. Runs
// until nothing changes, because one bye can create another further on
// (common in the losers bracket).
export function resolveByes(allMatches) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of allMatches) {
      if (isDecided(m)) continue;
      const a = slotState(allMatches, m, "A");
      const b = slotState(allMatches, m, "B");
      if (a === "dead" && b === "dead") {
        m.isVoid = true;
        changed = true;
      } else if ((a === "filled" && b === "dead") || (a === "dead" && b === "filled")) {
        m.isBye = true;
        m.winnerId = (m.teamA || m.teamB).id;
        advance(allMatches, m);
        changed = true;
      }
    }
  }
}

// null bestOf = free scoring (any points). Otherwise the score is games won
// in a best-of-N series: the winner has exactly ceil(N/2), the loser fewer.
export function winsNeeded(bestOf) {
  return bestOf ? Math.ceil(bestOf / 2) : null;
}

// Every valid final score for a best-of-N series, as [scoreA, scoreB].
export function seriesResults(bestOf) {
  const need = winsNeeded(bestOf);
  const out = [];
  for (let loser = 0; loser < need; loser++) out.push([need, loser]);
  for (let loser = need - 1; loser >= 0; loser--) out.push([loser, need]);
  return out;
}

// Returns an error message, or null if the score is acceptable.
export function validateScore(scoreA, scoreB, bestOf = null) {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return "Scores must be whole numbers, 0 or higher.";
  }
  if (scoreA === scoreB) return "Scores can't tie — every match needs a winner.";
  const need = winsNeeded(bestOf);
  if (need && (Math.max(scoreA, scoreB) !== need || Math.min(scoreA, scoreB) >= need)) {
    return `Best of ${bestOf}: the winner needs exactly ${need} game${need === 1 ? "" : "s"}.`;
  }
  return null;
}

// Mutates `allMatches`; callers hand in a copy (see TournamentsContext).
export function submitResult(allMatches, match, scoreA, scoreB, { bestOf = null } = {}) {
  if (!isReady(match)) throw new Error("This match isn't ready to be played.");
  const error = validateScore(scoreA, scoreB, bestOf);
  if (error) throw new Error(error);
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerId = scoreA > scoreB ? match.teamA.id : match.teamB.id;
  advance(allMatches, match);
  resolveByes(allMatches);
}

// Live scores while a match is being played. Checked on every +/− so a
// best-of-N match can't go past N/2 wins or reach a tie at the target.
export function validateLiveScore(scoreA, scoreB, bestOf = null) {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return "Scores must be whole numbers, 0 or higher.";
  }
  const need = winsNeeded(bestOf);
  if (need && (scoreA > need || scoreB > need)) return `Best of ${bestOf} is first to ${need}.`;
  if (need && scoreA === need && scoreB === need) return "Only one side can reach the winning score.";
  return null;
}

export function hasStarted(match) {
  return match.scoreA != null || match.scoreB != null;
}

// Matches this one's winner (and loser) were sent to.
function targetsOf(allMatches, match) {
  const out = [];
  if (match.nextMatchId) out.push({ target: findMatch(allMatches, match.nextMatchId), slot: match.nextSlot });
  if (match.loserNextMatchId && !match.isBye) {
    out.push({ target: findMatch(allMatches, match.loserNextMatchId), slot: match.loserNextSlot });
  }
  return out;
}

// A finished match can be reopened only while nothing that depends on its
// result has started. Byes that were auto-advanced because of it don't
// count as started; they get undone along with it.
function canUndo(allMatches, match) {
  for (const { target } of targetsOf(allMatches, match)) {
    if (target.isBye) {
      if (!canUndo(allMatches, target)) return false;
    } else if (target.winnerId || hasStarted(target)) {
      return false;
    }
  }
  if (match.isGrandFinal) {
    const reset = allMatches.find((m) => m.isReset);
    if (reset && (reset.winnerId || hasStarted(reset))) return false;
  }
  return true;
}

export function canReopen(allMatches, match) {
  return Boolean(match.winnerId) && !match.isBye && canUndo(allMatches, match);
}

function undoAdvance(allMatches, match) {
  for (const { target, slot } of targetsOf(allMatches, match)) {
    if (target.isBye) {
      undoAdvance(allMatches, target);
      target.isBye = false;
      target.winnerId = null;
    }
    if (slot === "A") target.teamA = null;
    else target.teamB = null;
  }
  if (match.isGrandFinal) {
    const reset = allMatches.find((m) => m.isReset);
    if (reset) {
      reset.isVoid = false;
      reset.teamA = null;
      reset.teamB = null;
    }
  }
}

// Takes a result back so the score can be corrected. Scores are kept.
export function reopenMatch(allMatches, match) {
  if (!canReopen(allMatches, match)) {
    throw new Error("Can't reopen this match: a later match that depends on it has already started.");
  }
  undoAdvance(allMatches, match);
  match.winnerId = null;
}

export function isComplete(allMatches) {
  return allMatches.every(isDecided);
}

// What an empty slot actually means, instead of a bare "TBD".
export function slotLabel(allMatches, match, slot) {
  const team = slot === "A" ? match.teamA : match.teamB;
  if (team) return team.name;
  if (match.isReset) return "If needed";
  const source = slotSource(allMatches, match, slot);
  if (!source) return "Bye";
  const { feeder, kind } = source;
  if (feeder.isVoid || (kind === "loser" && feeder.isBye)) return "Bye";
  const verb = kind === "winner" ? "Winner" : "Loser";
  if (feeder.teamA && feeder.teamB) return `${verb} of ${feeder.teamA.name} vs ${feeder.teamB.name}`;
  return `${verb} of ${feeder.code}`;
}
