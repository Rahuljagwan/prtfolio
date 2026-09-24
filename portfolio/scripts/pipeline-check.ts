/* eslint-disable no-console */
// Checks for the release-pipeline simulation model. Run with:  npm run test:pipeline
// No browser or clock needed: the model is pure and seeded.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BASELINE_VERSION, DISCLAIMER, STAGES, applyRun, canRollback, initialLedger, liveVersion, nextVersion, planRun, rng, rollback, statusAt, type FailureMode } from "../src/lib/pipeline/model";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}
const ids = STAGES.map((s) => s.id);

// ---- the generator and determinism
{
  const a = rng(42);
  const b = rng(42);
  const xs = Array.from({ length: 5 }, () => a());
  check("rng: same seed gives the same sequence, values in [0, 1)", xs.every((x) => x === b() && x >= 0 && x < 1));
  check("rng: different seeds differ", rng(1)() !== rng(2)());
  const p1 = planRun(7, 1, "v1.4.3", "none");
  const p2 = planRun(7, 1, "v1.4.3", "none");
  check("plan: the same seed and run give an identical plan", JSON.stringify(p1) === JSON.stringify(p2));
  const other = planRun(8, 1, "v1.4.3", "none");
  check("plan: a different seed changes the timings but not the shape", JSON.stringify(other.stages.map((s) => s.end)) !== JSON.stringify(p1.stages.map((s) => s.end)) && other.stages.map((s) => s.id).join() === ids.join());
}

// ---- a clean run
{
  const p = planRun(3, 1, "v1.4.3", "none");
  check("clean: all seven stages pass, in order", p.stages.map((s) => s.id).join() === ids.join() && p.stages.every((s) => s.result === "passed"));
  check("clean: stages are back to back with no overlap and positive durations", p.stages.every((s, i) => s.end > s.start && (i === 0 || s.start === p.stages[i - 1].end)));
  check("clean: outcome is deployed", p.outcome === "deployed");
  check("clean: log is in time order and ends with the version going live", p.log.every((l, i) => i === 0 || l.at >= p.log[i - 1].at) && /v1\.4\.3 is live/.test(p.log[p.log.length - 1].text));
  check("clean: no error lines", !p.log.some((l) => l.level === "error"));
  check("clean: every stage's duration is within +-25% of its base", p.stages.every((s, i) => s.end - s.start >= STAGES[i].baseMs * 0.75 - 1 && s.end - s.start <= STAGES[i].baseMs * 1.25 + 1));
}

// ---- injected failures halt the run
for (const [failure, at, outcome] of [["tests", "tests", "failed"], ["canary", "canary", "halted"]] as [FailureMode, string, string][]) {
  const p = planRun(5, 2, "v1.4.4", failure);
  const i = ids.findIndex((x) => x === at);
  check(`${failure}: stages before it pass, it fails, everything after is skipped`, p.stages.slice(0, i).every((s) => s.result === "passed") && p.stages[i].result === "failed" && p.stages.slice(i + 1).every((s) => s.result === "skipped"));
  check(`${failure}: outcome is ${outcome}`, p.outcome === outcome);
  check(`${failure}: it logs an error and says nothing reached production`, p.log.some((l) => l.level === "error" && l.stage === at) && p.log.some((l) => /halting/.test(l.text)));
  check(`${failure}: skipped stages take no time`, p.stages.slice(i + 1).every((s) => s.start === s.end));
  check(`${failure}: the failure happens strictly inside its stage`, p.stages[i].end > p.stages[i].start);
}
{
  const p = planRun(5, 2, "v1.4.4", "canary");
  check("canary failure: reverts automatically and says so", p.log.some((l) => /reverting the canary/.test(l.text)) && p.log.some((l) => /back on the previous version/.test(l.text)));
  check("canary failure: production is never promoted", p.stages.find((s) => s.id === "production")!.result === "skipped");
}

// ---- reading the plan at a point in time
{
  const p = planRun(9, 1, "v1.4.3", "none");
  let mono = true;
  let lastDone = -1;
  let lastLog = -1;
  for (let e = 0; e <= p.totalMs + 500; e += 50) {
    const v = statusAt(p, e);
    const finished = v.stages.filter((s) => s.status === "passed" || s.status === "failed" || s.status === "skipped").length;
    mono = mono && finished >= lastDone && v.log.length >= lastLog && v.stages.filter((s) => s.status === "running").length <= 1;
    lastDone = finished;
    lastLog = v.log.length;
  }
  check("view: finished stages and log lines never go backwards; at most one stage runs at a time", mono);
  const start = statusAt(p, 0);
  check("view: at 0 ms nothing has finished and the run is not done", start.stages.filter((s) => s.status === "passed").length === 0 && start.log.length >= 1 && !start.done);
  const end = statusAt(p, p.totalMs + 10);
  check("view: at the end everything has passed and the run is done", end.done && end.stages.every((s) => s.status === "passed") && end.log.length === p.log.length && end.active === null);
  check("view: garbage times are safe", [NaN, -50, Infinity].every((x) => statusAt(p, x).stages.length === 7));
  check("view: progress stays within 0..1", Array.from({ length: 60 }, (_, k) => statusAt(p, k * 300)).every((v) => v.stages.every((s) => s.progress >= 0 && s.progress <= 1)));
  check("view: traffic always adds up to 100 and ends fully on the new version", Array.from({ length: 80 }, (_, k) => statusAt(p, k * 200)).every((v) => v.traffic.previous + v.traffic.next === 100) && end.traffic.next === 100);
  const f = planRun(9, 1, "v1.4.3", "canary");
  check("view: a halted run ends with no traffic on the new version", statusAt(f, f.totalMs + 10).traffic.next === 0);
  const during = f.stages.find((s) => s.id === "canary")!;
  check("view: the canary carries 5% of traffic while it runs", statusAt(f, (during.start + during.end) / 2).traffic.next === 5);
  const skipped = statusAt(planRun(2, 1, "v1.4.3", "tests"), 0).stages.filter((s) => s.status === "skipped");
  check("view: stages a failed run will skip are pending until it stops, not skipped from the start", skipped.length === 0);
}

// ---- what is live and rollback
{
  let l = initialLedger();
  check("ledger: starts with a baseline live and nothing to roll back to", liveVersion(l) === BASELINE_VERSION && !canRollback(l) && rollback(l) === null && l.history.length === 1);
  const ok = planRun(1, l.nextRun, nextVersion(l), "none");
  l = applyRun(l, ok);
  check("ledger: a deployed run becomes live and enables rollback", liveVersion(l) === "v1.4.3" && canRollback(l));
  const bad = planRun(1, l.nextRun, nextVersion(l), "tests");
  const after = applyRun(l, bad);
  check("ledger: a failed run never changes what is live, but is recorded", liveVersion(after) === "v1.4.3" && after.history[0].outcome === "failed" && after.deployed.length === l.deployed.length);
  const halted = applyRun(after, planRun(1, after.nextRun, nextVersion(after), "canary"));
  check("ledger: a halted canary never changes what is live either", liveVersion(halted) === "v1.4.3" && halted.history[0].outcome === "halted");
  check("ledger: version numbers move forward on every run, including failed ones", nextVersion(after) === "v1.4.5" && nextVersion(halted) === "v1.4.6");
  const back = rollback(l)!;
  check("ledger: rollback restores the previous release and records it", liveVersion(back) === BASELINE_VERSION && back.history[0].kind === "rollback" && /restored v1\.4\.2 \(was v1\.4\.3\)/.test(back.history[0].note));
  check("ledger: after rolling back to the baseline there is nothing further to roll back to", !canRollback(back));
  const two = applyRun(applyRun(initialLedger(), planRun(1, 1, "v1.4.3", "none")), planRun(1, 2, "v1.4.4", "none"));
  check("ledger: rollback steps back one release at a time", liveVersion(rollback(two)!) === "v1.4.3" && liveVersion(rollback(rollback(two)!)!) === BASELINE_VERSION);
  check("ledger: history is newest first and never loses entries", two.history.length === 3 && two.history[0].version === "v1.4.4");
}

// ---- honesty
check("the disclaimer says it is a simulation and not this site's pipeline", /simulation/i.test(DISCLAIMER) && /not this site's pipeline/i.test(DISCLAIMER));
{
  // The page tells visitors this site has no CI workflow. That is true today; if one is ever added, this fails so the copy gets updated.
  const hasCi = ["../.github/workflows", ".github/workflows"].some((p) => existsSync(join(__dirname, "..", p)));
  check("the copy 'this site has no CI workflow' is still true", !hasCi);
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
