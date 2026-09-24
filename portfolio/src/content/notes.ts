// Short technical notes. Both are ILLUSTRATIVE samples (sample: true): they show the format and the tone, and the pages carry a
// "Sample" banner and are kept out of search indexing until they are replaced with the author's own writing.
// Bodies are typed blocks, not HTML, so a note can never inject markup.

export type NoteBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; lang?: string; text: string }
  | { type: "quote"; text: string };

export interface Note {
  slug: string;
  title: string;
  /** ISO date. */
  date: string;
  summary: string;
  tags: string[];
  body: NoteBlock[];
  sample: true;
}

export const NOTES: Note[] = [
  {
    slug: "why-nginx-in-front-of-gunicorn",
    title: "Why I put Nginx in front of Gunicorn",
    date: "2026-06-02",
    summary: "An application server is good at running your code and bad at being the front door. A short case for the proxy.",
    tags: ["nginx", "gunicorn", "deployment"],
    body: [
      { type: "p", text: "Gunicorn will happily listen on a public port and serve requests. It works, and it is the wrong shape for the job." },
      { type: "h2", text: "What the proxy does that the app server should not" },
      {
        type: "list",
        items: [
          "Serves static files straight from disk, without waking a Python worker.",
          "Absorbs slow clients. A phone on a bad connection holds an Nginx connection, not one of your few workers.",
          "Is the one place for TLS, size limits and timeouts.",
          "Lets you restart the app without dropping the connection the user is holding.",
        ],
      },
      { type: "h2", text: "The smallest useful setup" },
      { type: "code", lang: "nginx", text: "location / {\n    proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    proxy_pass http://unix:/run/gunicorn/app.sock;\n}" },
      { type: "p", text: "The forwarded headers matter more than they look: without them the application believes every request came from the proxy, over plain HTTP." },
      { type: "quote", text: "The app server runs your code. The proxy faces the internet." },
    ],
    sample: true,
  },
  {
    slug: "what-i-check-first-when-a-deploy-misbehaves",
    title: "What I check first when a deploy misbehaves",
    date: "2026-07-14",
    summary: "A short, boring checklist. Boring is the point: it is what gets you to the cause fastest at the worst time.",
    tags: ["operations", "debugging"],
    body: [
      { type: "p", text: "When something breaks right after a release, the temptation is to start guessing. This is the order I try to follow instead." },
      {
        type: "list",
        items: [
          "What changed? The release is the prime suspect, and the diff is short.",
          "Is it everywhere or somewhere? One host, one region or one kind of request points in very different directions.",
          "Read the logs at the moment it started, not the loudest error.",
          "Check the boring resources: disk, memory, connections, certificates, DNS.",
          "If the release is guilty and the fix is not obvious, roll back first and investigate second.",
        ],
      },
      { type: "h2", text: "Rolling back is a feature" },
      { type: "p", text: "Being able to undo a release quickly is worth more than being able to make one quickly. If rollback is scary, that is the thing to fix." },
    ],
    sample: true,
  },
];
