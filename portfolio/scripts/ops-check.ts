/* eslint-disable no-console */
// Checks for the ops-proof helpers (security.txt, the status badge's time/label maths, vitals ratings). Run with:  npm run test:ops
import { buildSecurityTxt, isPlaceholderEmail } from "../src/lib/security-txt";
import { ageLabel, rateVital, statusLine } from "../src/lib/ops";
import { CONNECT_TIMEOUT_SECONDS, createBreaker, describeDbError, isConnectionError, withConnectTimeout } from "../src/lib/db-resilience";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}

// ---- security.txt: never points a researcher at a placeholder
check("placeholder: the seed's example.com address", isPlaceholderEmail("rahul@example.com"));
check("placeholder: reserved test domains", ["a@site.test", "a@host.invalid", "a@x.localhost", "a@example.org"].every(isPlaceholderEmail));
check("placeholder: obvious filler and malformed values", ["your-email@gmail.com", "changeme@corp.io", "placeholder@corp.io", "not-an-email", "", "  "].every(isPlaceholderEmail));
check("placeholder: a real address is not one", !isPlaceholderEmail("kaushalmishra.mk@gmail.com") && !isPlaceholderEmail("  me@corp.dev "));

const now = new Date("2026-09-24T00:00:00Z");
check("security.txt: no file for a placeholder or a missing email", buildSecurityTxt({ email: "rahul@example.com", now }) === null && buildSecurityTxt({ email: undefined, now }) === null);
{
  const body = buildSecurityTxt({ email: "me@corp.dev", canonical: "https://corp.dev", now }) ?? "";
  const lines = body.trim().split("\n");
  check("security.txt: starts with the Contact line", lines[0] === "Contact: mailto:me@corp.dev", lines[0]);
  const expires = new Date((lines.find((l) => l.startsWith("Expires:")) ?? "").slice(9));
  const days = (expires.getTime() - now.getTime()) / 86_400_000;
  check("security.txt: Expires is in the future and under a year (RFC 9116)", days > 0 && days < 365, String(days));
  check("security.txt: Canonical only when the origin is known", lines.includes("Canonical: https://corp.dev/.well-known/security.txt") && !(buildSecurityTxt({ email: "me@corp.dev", now }) ?? "").includes("Canonical"));
  check("security.txt: ends with a newline", body.endsWith("\n"));
}

// ---- how long ago the build was made
const H = 3_600_000;
check("age: under a minute is 'just now'", ageLabel(0, 30_000) === "just now");
check("age: minutes", ageLabel(0, 5 * 60_000) === "5 min ago");
check("age: hours", ageLabel(0, 3 * H) === "3 h ago");
check("age: days", ageLabel(0, 49 * H) === "2 d ago");
check("age: a build 'in the future' (clock skew) is 'just now', never negative", ageLabel(10_000, 0) === "just now");
check("age: garbage is empty, not 'NaN d ago'", ageLabel(NaN, 5) === "" && ageLabel(0, NaN) === "");

// ---- the badge says only what is true
check("status: local build says so and never says deployed", statusLine({ env: "local" }) === "local build");
check("status: a real deployment names its environment", statusLine({ env: "production" }) === "production" && statusLine({ env: "preview", region: "iad1" }) === "preview · iad1");
check("status: nothing in the line ever claims 'deployed' or 'up'", ["local", "production", "preview", ""].every((e) => !/deployed|\bup\b/i.test(statusLine({ env: e, region: "iad1" }))));

// ---- web vitals ratings (thresholds from web.dev)
check("vitals: LCP", rateVital("lcp", 2000) === "good" && rateVital("lcp", 3000) === "needs-improvement" && rateVital("lcp", 4500) === "poor");
check("vitals: CLS", rateVital("cls", 0.05) === "good" && rateVital("cls", 0.15) === "needs-improvement" && rateVital("cls", 0.3) === "poor");
check("vitals: FCP, TTFB, interaction delay", rateVital("fcp", 1500) === "good" && rateVital("ttfb", 1000) === "needs-improvement" && rateVital("inp", 600) === "poor");
check("vitals: the boundary values are still 'good' (web.dev is inclusive)", rateVital("lcp", 2500) === "good" && rateVital("cls", 0.1) === "good");

// ---- a sleeping or unreachable database must not hurt the site
{
  const url = "postgresql://user:pw@ep-x-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const out = withConnectTimeout(url) ?? "";
  check("db url: adds a connect timeout that outlasts a Neon wake-up (> 5 s)", out.includes(`connect_timeout=${CONNECT_TIMEOUT_SECONDS}`) && CONNECT_TIMEOUT_SECONDS > 5, out);
  check("db url: keeps every other parameter and the credentials as they were", out.includes("sslmode=require") && out.includes("channel_binding=require") && out.startsWith("postgresql://user:pw@ep-x-pooler"), out);
  check("db url: an explicit connect_timeout is respected, and calling twice changes nothing", withConnectTimeout(`${url}&connect_timeout=3`)?.includes("connect_timeout=3") === true && withConnectTimeout(out) === out);
  check("db url: empty and unparseable values pass through untouched", withConnectTimeout(undefined) === undefined && withConnectTimeout("") === "" && withConnectTimeout("not a url") === "not a url");

  check("db error: connection failures are recognised (by code, by name, by message)", isConnectionError({ code: "P1001" }) && isConnectionError({ errorCode: "P1017" }) && isConnectionError({ name: "PrismaClientInitializationError", message: "x" }) && isConnectionError(new Error("Can't reach database server at `h:5432`")));
  check("db error: a bug in a query is not a connection failure", !isConnectionError(new Error("Unknown argument `foo`")) && !isConnectionError({ code: "P2002" }) && !isConnectionError(null) && !isConnectionError("nope"));
  const msg = "\nInvalid `prisma.contactLink.findMany()` invocation:\n\n\nCan't reach database server at `ep-winter-boat-pooler.c-6.us-east-2.aws.neon.tech:5432`\n\nPlease make sure your database server is running";
  check("db error: the log line names the host, without the port or a stack trace", describeDbError(new Error(msg)) === "cannot reach ep-winter-boat-pooler.c-6.us-east-2.aws.neon.tech", describeDbError(new Error(msg)));
  check("db error: a connection string in a message is never logged", !describeDbError(new Error("failed for postgresql://user:secret@host/db")).includes("secret"));

  let t = 1000;
  const b = createBreaker(30_000, () => t);
  check("breaker: starts closed", !b.isOpen());
  check("breaker: trip opens it and reports that it was newly opened", b.trip() === true && b.isOpen());
  t += 29_999;
  check("breaker: stays open for the whole window, and a repeat trip reports it was already open (log once)", b.isOpen() && b.trip() === false);
  t += 30_001;
  check("breaker: closes again once the window has passed", !b.isOpen());
  b.trip();
  b.reset();
  check("breaker: reset closes it at once", !b.isOpen());
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
