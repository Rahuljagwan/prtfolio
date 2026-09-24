// Blameless post-incident reviews. These two are ILLUSTRATIVE (sample: true): they show the format and the way of thinking,
// they are not accounts of real incidents, and nothing here comes from any employer's systems. The page marks each one
// "Sample" until it is replaced with a real review written by the author.

export type Severity = "sev1" | "sev2" | "sev3";

export interface Postmortem {
  slug: string;
  title: string;
  /** ISO date the (illustrative) incident happened. */
  date: string;
  severity: Severity;
  duration: string;
  summary: string;
  impact: string;
  timeline: { time: string; text: string }[];
  rootCause: string;
  fix: string;
  prevention: string[];
  wentWell: string[];
  wentBadly: string[];
  sample: true;
}

export const SEVERITY_LABEL: Record<Severity, string> = { sev1: "SEV-1 · service down", sev2: "SEV-2 · degraded", sev3: "SEV-3 · minor" };

export const POSTMORTEMS: Postmortem[] = [
  {
    slug: "disk-full-unrotated-logs",
    title: "The application server ran out of disk",
    date: "2026-03-12",
    severity: "sev1",
    duration: "47 minutes",
    summary: "Application logs were never rotated. The disk filled overnight, the database stopped accepting writes, and every request that needed one failed.",
    impact: "Approvals could not be saved for 47 minutes during the morning peak. Reads still worked. No data was lost.",
    timeline: [
      { time: "07:52", text: "First failed save reported by a user." },
      { time: "07:58", text: "Confirmed on the server: the root volume was at 100%." },
      { time: "08:06", text: "Found the cause with du: one log directory held most of the space." },
      { time: "08:14", text: "Compressed and moved the old logs off the box, freeing about 60% of the disk." },
      { time: "08:39", text: "Writes recovering; database restarted cleanly and a test save succeeded." },
    ],
    rootCause: "The application logged every request at debug level and nothing rotated or capped those files. The disk had been filling for weeks. There was no alert on disk usage, so the first signal was a user.",
    fix: "Freed space by archiving old logs, dropped the log level to info, and added log rotation (daily, 14 kept, compressed).",
    prevention: [
      "Alert at 80% disk usage, well before it can hurt.",
      "Rotate and cap every log by default, in the service's own setup, not as an afterthought.",
      "Keep debug logging behind a switch that expires.",
    ],
    wentWell: ["The symptom pointed at the disk within minutes.", "Restoring space first, then fixing the cause, kept the outage short."],
    wentBadly: ["Nothing warned us: a user found it before we did.", "The log level was set for a debugging session and never set back."],
    sample: true,
  },
  {
    slug: "reminders-stalled-scheduler",
    title: "Reminder emails silently stopped",
    date: "2026-05-27",
    severity: "sev2",
    duration: "About 19 hours",
    summary: "A scheduled job that sends reminders hung on a slow mail relay, and because it never crashed, nothing restarted it and nothing alerted.",
    impact: "Roughly a day of reminders were not sent. Approvers who relied on them acted late. The application itself stayed healthy.",
    timeline: [
      { time: "Day 1, 09:00", text: "The scheduled reminder job starts and blocks on a mail relay that has stopped responding." },
      { time: "Day 1, 09:00 to Day 2, 04:00", text: "The job never finishes, so the next runs are skipped. No errors are logged." },
      { time: "Day 2, 04:10", text: "A user reports that reminders have stopped." },
      { time: "Day 2, 04:25", text: "Traced the hang to the mail call with no timeout. Killed the job and re-ran it manually." },
      { time: "Day 2, 04:40", text: "Reminders sent; the backlog cleared." },
    ],
    rootCause: "The mail client had no timeout, so one unresponsive relay blocked the job forever. The scheduler treated a still-running job as healthy, and there was no check that reminders were actually going out.",
    fix: "Added a timeout and a bounded retry to the mail call, and a maximum runtime after which the scheduler kills the job.",
    prevention: [
      "Every network call gets a timeout. No exceptions.",
      "Monitor the outcome, not the process: alert if no reminder has been sent in the expected window.",
      "Log job start and finish, so a run that never finishes is visible.",
    ],
    wentWell: ["Once found, the fix was small and the backlog cleared in minutes."],
    wentBadly: ["A hung job looks like a healthy job. We were watching the wrong thing.", "It took a human report, 19 hours later, to notice."],
    sample: true,
  },
];
