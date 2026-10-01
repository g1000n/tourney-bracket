// Plays thousands of random tournaments in every format and checks the
// results are sane: right number of matches, byes only where they belong,
// loss counts in double elim, every pair once in round robin, and no early
// rematches in double elim up to 8 players (see doubleElimination.js).
//
//   npm run check:brackets

const lib = await import("../src/lib/bracket.js");
const { generateTournament, submitResult, isReady, isComplete, computeStandings, podium, placements, validateScore, seriesResults, validateLiveScore, canReopen, reopenMatch, matchBestOf } = lib;

const fail = [];
const earlyByN = {};
let totalReopens = 0;
const check = (cond, msg) => { if (!cond) fail.push(msg); };

function mkTeams(n, rankedFrac) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, rank: Math.random() < rankedFrac ? i + 1 : null }));
}

function play(format, n, opts = {}) {
  const teams = mkTeams(n, Math.random());
  const t = generateTournament(format, teams, opts);
  const all = t.allMatches;
  const idsInRounds = t.rounds.flatMap((r) => r.matchIds);
  check(idsInRounds.length === all.length && new Set(idsInRounds).size === all.length, `${format} n=${n}: rounds/allMatches mismatch`);
  const lbCount = Math.max(0, ...all.filter((m) => m.bracketSide === "losers").map((m) => m.round + 1));
  // matchId -> { loserId, key, rematch } for every result currently standing
  const results = new Map();
  const losses = {};
  let played = 0;
  let reopens = 0;
  for (let guard = 0; guard < 10000; guard++) {
    // Now and then, take back a result that can still be reopened (as an
    // admin fixing a score would) and let it be replayed.
    if (reopens < n && Math.random() < 0.15) {
      const candidates = all.filter((m) => canReopen(all, m));
      if (candidates.length) {
        const m = candidates[Math.floor(Math.random() * candidates.length)];
        reopenMatch(all, m);
        check(isReady(m) && !m.winnerId, `${format} n=${n}: reopened ${m.code} isn't playable`);
        const r = results.get(m.id);
        losses[r.loserId]--;
        results.delete(m.id);
        played--;
        reopens++;
        totalReopens++;
        continue;
      }
    }
    const ready = all.filter(isReady);
    if (!ready.length) break;
    const m = ready[Math.floor(Math.random() * ready.length)];
    for (const tm of [m.teamA, m.teamB]) check((losses[tm.id] || 0) < (format === "double_elimination" ? 2 : format === "single_elimination" && !m.isThirdPlace ? 1 : 99), `${format} n=${n}: eliminated player ${tm.name} playing ${m.code}`);
    const key = [m.teamA.id, m.teamB.id].sort().join("|");
    const rematch = [...results.values()].some((r) => r.key === key);
    const a = Math.floor(Math.random() * 10);
    let b = Math.floor(Math.random() * 10);
    if (b === a) b = a + 1;
    submitResult(all, m, a, b);
    const loser = m.winnerId === m.teamA.id ? m.teamB : m.teamA;
    losses[loser.id] = (losses[loser.id] || 0) + 1;
    results.set(m.id, { loserId: loser.id, key, rematch });
    played++;
  }
  const rematches = all.filter((m) => results.get(m.id)?.rematch);
  const met = new Set([...results.values()].map((r) => r.key));
  check(isComplete(all), `${format} n=${n}: not complete after play`);
  const tt = { ...t, teams, format, status: "complete" };
  const pod = podium(tt);
  check(pod && pod.first, `${format} n=${n}: no champion`);
  const places = placements(tt);
  check(teams.every((tm) => places.has(tm.id)), `${format} n=${n}: player missing a placement`);
  check(places.get(pod.first.id).label === (format === "round_robin" ? "1st" : "Champion"), `${format} n=${n}: champion placement wrong`);

  if (format === "single_elimination") {
    const tp = opts.thirdPlace && n >= 4 ? 1 : 0;
    check(played === n - 1 + tp, `SE n=${n}: played ${played}, expected ${n - 1 + tp}`);
    check(all.filter((m) => m.isBye).every((m) => m.round === 0), `SE n=${n}: bye outside round 1`);
    check(rematches.length === 0, `SE n=${n}: rematch`);
    check(!losses[pod.first.id], `SE n=${n}: champion has a loss`);
  }
  if (format === "double_elimination") {
    const reset = all.find((m) => m.isReset);
    check(played === 2 * n - 2 + (reset.isVoid ? 0 : 1), `DE n=${n}: played ${played}`);
    for (const tm of teams) {
      const l = losses[tm.id] || 0;
      if (tm.id === pod.first.id) check(l <= 1, `DE n=${n}: champion has ${l} losses`);
      else check(l === 2, `DE n=${n}: ${tm.name} finished with ${l} losses`);
    }
    for (const m of rematches) {
      const allowed = m.bracketSide === "final" || (m.bracketSide === "losers" && m.round >= lbCount - 2);
      if (!allowed) earlyByN[n] = (earlyByN[n] || 0) + 1;
      if (n <= 8) check(allowed, `DE n=${n}: early rematch in ${m.code} (${m.bracketSide}, LB rounds=${lbCount})`);
    }
  }
  if (format === "round_robin") {
    check(played === (n * (n - 1)) / 2 && met.size === played, `RR n=${n}: played ${played}`);
    const st = computeStandings(teams, all);
    check(st.reduce((s, r) => s + r.wins, 0) === played, `RR n=${n}: wins don't add up`);
    // nobody plays twice in a round
    for (const r of t.rounds) {
      const ids = r.matchIds.flatMap((id) => { const m = all.find((x) => x.id === id); return [m.teamA.id, m.teamB.id]; });
      check(new Set(ids).size === ids.length, `RR n=${n}: player twice in ${r.label}`);
    }
  }
}

for (let n = 2; n <= 33; n++) {
  const trials = n <= 16 ? 150 : 40;
  for (let i = 0; i < trials; i++) {
    if (n >= 4) play("single_elimination", n, { thirdPlace: true });
    play("single_elimination", n, { thirdPlace: false });
    play("double_elimination", n);
    if (i < 20) play("round_robin", n);
  }
}
// 3rd-place match needs 4+ players.
for (const n of [2, 3]) {
  let threw = false;
  try { generateTournament("single_elimination", mkTeams(n, 0), { thirdPlace: true }); } catch { threw = true; }
  check(threw, `SE n=${n}: 3rd-place match with fewer than 4 players was allowed`);
}

// Best-of scoring: only real series results are accepted.
check(JSON.stringify(seriesResults(3)) === "[[2,0],[2,1],[1,2],[0,2]]", "Bo3 series results wrong");
for (const [a, b] of [[2, 0], [2, 1], [0, 2], [1, 2]]) check(validateScore(a, b, 3) === null, `Bo3 rejected ${a}-${b}`);
for (const [a, b] of [[3, 0], [5, 2], [1, 0], [2, 2], [3, 2], [-1, 2]]) check(validateScore(a, b, 3) !== null, `Bo3 accepted ${a}-${b}`);
check(validateScore(1, 0, 1) === null && validateScore(2, 0, 1) !== null, "Bo1 scoring wrong");
check(validateScore(17, 3) === null && validateScore(1.5, 0) !== null, "free scoring wrong");
{
  const t = generateTournament("round_robin", mkTeams(2, 0));
  let threw = false;
  try { submitResult(t.allMatches, t.allMatches[0], 9, 0, { bestOf: 3 }); } catch { threw = true; }
  check(threw && !t.allMatches[0].winnerId, "submitResult accepted 9-0 in a best of 3");
}

// Live scoring limits.
check(validateLiveScore(1, 1, 3) === null && validateLiveScore(2, 1, 3) === null, "Bo3 live score rejected a valid score");
check(validateLiveScore(3, 0, 3) !== null && validateLiveScore(2, 2, 3) !== null && validateLiveScore(-1, 0) !== null, "Bo3 live score allowed an invalid score");
check(validateLiveScore(40, 38) === null, "free live score rejected");

// Reopening is blocked once a dependent match has started.
{
  const t = generateTournament("single_elimination", mkTeams(4, 1), { thirdPlace: false });
  const [s1, s2, final] = t.allMatches;
  submitResult(t.allMatches, s1, 2, 0);
  submitResult(t.allMatches, s2, 2, 1);
  check(canReopen(t.allMatches, s1), "SE: can't reopen a semifinal before the final starts");
  final.scoreA = 1;
  final.scoreB = 0;
  check(!canReopen(t.allMatches, s1), "SE: reopened a semifinal while the final is live");
  final.scoreA = final.scoreB = null;
  reopenMatch(t.allMatches, s1);
  check(final.teamA === null && final.teamB && isReady(s1), "SE: reopen didn't clear the final's slot");
}

// Random seeding ignores ranks; seeds are recorded 1..n.
{
  const teams = mkTeams(8, 1);
  let differs = false;
  for (let i = 0; i < 20 && !differs; i++) {
    const copy = teams.map((x) => ({ ...x }));
    generateTournament("single_elimination", copy, { random: true, thirdPlace: false });
    differs = copy.some((x) => x.seed !== x.rank);
  }
  check(differs, "random seeding followed the ranks");
  const ranked = teams.map((x) => ({ ...x }));
  generateTournament("single_elimination", ranked, { random: false, thirdPlace: false });
  check(ranked.every((x) => x.seed === x.rank), "ranked seeding didn't follow the ranks");
}

// Semifinals-onward match length.
{
  const t = generateTournament("double_elimination", mkTeams(8, 0), { bestOf: 3, lateBestOf: 5 });
  const lengths = Object.fromEntries(t.rounds.map((r) => [r.label, r.bestOf]));
  check(lengths["Winners Quarterfinals"] === 3 && lengths["Losers Round 1"] === 3, "DE early rounds length wrong");
  check(lengths["Winners Semifinals"] === 5 && lengths["Losers Semifinal"] === 5 && lengths["Grand Final"] === 5, "DE late rounds length wrong");
  const se = generateTournament("single_elimination", mkTeams(8, 0), { bestOf: 1, lateBestOf: 3, thirdPlace: true });
  check(se.rounds.map((r) => r.bestOf).join() === "1,3,3,3", "SE round lengths wrong: " + se.rounds.map((r) => r.bestOf).join());
  check(matchBestOf({ ...se, bestOf: 1 }, se.rounds[1].matchIds[0]) === 3, "matchBestOf ignored the round");
}

check(totalReopens > 1000, `only ${totalReopens} reopens were exercised`);
console.log(`Reopened and replayed ${totalReopens} results during the simulation.`);
const uniq = [...new Set(fail)];
console.log(uniq.length ? uniq.slice(0, 40).join("\n") : "All checks passed.");
if (fail.length) process.exitCode = 1;
console.log("Double elim early rematches by player count (n > 8, not a failure):", JSON.stringify(earlyByN));
