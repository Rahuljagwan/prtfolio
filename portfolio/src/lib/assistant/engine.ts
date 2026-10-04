import type { Portfolio } from "@/lib/types";
import { buildChunks, type Anchor, type Chunk } from "./knowledge";

/**
 * Grounded question answering with no external AI service.
 *
 * How it stays honest:
 *  - The only input is the portfolio content. Every sentence in an answer is either fixed wording (greetings,
 *    "I could not find...") or text copied from a stored field.
 *  - Nothing is generated, paraphrased or inferred, so it cannot invent a fact.
 *  - If nothing in the content matches, it says so instead of guessing.
 *
 * Order of resolution: safety refusal, greeting, about, named project, technology lookup, topic intents
 * (education, contact, resume, availability, journey, experience, projects, skills, location), then keyword ranking.
 */

export interface Source {
  label: string;
  anchor: Anchor;
}

export interface Answer {
  answer: string;
  sources: Source[];
  /** False for refusals, greetings and "not found" replies. */
  grounded: boolean;
  /** Set for replies that are fixed wording rather than content. Absent means a normal content answer. */
  kind?: "refusal" | "greeting" | "notfound";
}

const ANCHOR_LABEL: Record<Anchor, string> = {
  hero: "Home",
  about: "About",
  experience: "Experience",
  journey: "My path",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  contact: "Contact",
};

const BASE_STOP = [
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "with", "by", "from", "as", "is", "are", "was", "were", "be",
  "been", "do", "does", "did", "can", "could", "would", "should", "will", "has", "have", "had", "he", "she", "they", "his", "her",
  "their", "him", "it", "its", "this", "that", "these", "those", "what", "which", "who", "whom", "whose", "how", "why", "when",
  "where", "about", "tell", "me", "you", "your", "yours", "please", "any", "some", "there", "here", "also", "much", "many", "get",
  "got", "s", "i", "my", "we", "us", "know", "knows", "use", "uses", "used", "using", "work", "worked", "experience", "skill",
];

// ---------------------------------------------------------------------------------------------- text utilities

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/c\+\+/g, "cpp")
    .replace(/c#/g, "csharp")
    .replace(/\.net\b/g, "dotnet")
    .replace(/ci\s*\/\s*cd/g, "cicd")
    .replace(/\b(node|next|vue|express)\.js\b/g, "$1js")
    .replace(/&/g, " and ");
}

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Lower-cased, stemmed tokens. */
function tokens(s: string): string[] {
  return normalise(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .map(stem);
}

// Generic words that should not, on their own, count as a technology match ("rest" in "REST APIs", "response" in "Incident response").
const GENERIC = new Set([
  "rest", "incident", "response", "cloud", "development", "design", "management", "system", "security", "control", "job",
  // Plain English words that the resume's multi-word skills carry ("Role-Based Access Control", "Server configuration and deployment",
  // "Rate limiting", "Cross-functional teamwork", "SIT / UAT support", "Progressive Web Apps"...): none of them names a technology on its own,
  // and "Where is he based?" must not be answered as a question about a technology called "based".
  // (Words are stemmed before they are compared with this list, so "based" is listed as its stem, "bas".)
  "role", "based", "bas", "access", "server", "configuration", "deployment", "rate", "limit", "session", "technical", "documentation", "support",
  "web", "app", "cross", "functional", "debugg", "debug", "troubleshoot", "agile", "collaboration", "finding", "closure", "remediation",
  "teamwork", "progressive", "material", "toolkit", "query", "compose", "sit", "next",
]);

// Well-known technologies. If the visitor names one and it is not in the portfolio, the assistant says so plainly.
const COMMON_TECH = [
  "kubernetes", "k8s", "terraform", "ansible", "jenkins", "java", "rust", "ruby", "rails", "php", "laravel", "django", "fastapi",
  "spring", "angular", "vue", "svelte", "azure", "gcp", "kafka", "rabbitmq", "mongodb", "mysql", "redis", "graphql", "typescript",
  "nextjs", "nodejs", "express", "cpp", "csharp", "dotnet", "swift", "kotlin", "android", "ios", "tensorflow", "pytorch", "lambda",
  "cloudformation", "prometheus", "grafana", "datadog", "gitlab", "circleci", "argocd", "helm", "docker", "python", "javascript",
  "react", "flask", "postgresql", "postgres", "aws", "linux", "nginx", "git", "sql", "golang", "scala", "elasticsearch", "sqlite",
  "oracle", "firebase", "supabase", "vercel", "heroku", "openai", "llm", "machine learning",
];
const TECH_ALIAS: Record<string, string> = { k8s: "kubernetes", postgres: "postgresql", golang: "go" };
const TECH_DISPLAY: Record<string, string> = {
  kubernetes: "Kubernetes", terraform: "Terraform", ansible: "Ansible", jenkins: "Jenkins", java: "Java", rust: "Rust", ruby: "Ruby",
  rails: "Rails", php: "PHP", laravel: "Laravel", django: "Django", fastapi: "FastAPI", spring: "Spring", angular: "Angular",
  vue: "Vue", svelte: "Svelte", azure: "Azure", gcp: "GCP", kafka: "Kafka", rabbitmq: "RabbitMQ", mongodb: "MongoDB", mysql: "MySQL",
  redis: "Redis", graphql: "GraphQL", typescript: "TypeScript", nextjs: "Next.js", nodejs: "Node.js", express: "Express", cpp: "C++",
  csharp: "C#", dotnet: ".NET", swift: "Swift", kotlin: "Kotlin", android: "Android", ios: "iOS", tensorflow: "TensorFlow",
  pytorch: "PyTorch", lambda: "AWS Lambda", cloudformation: "CloudFormation", prometheus: "Prometheus", grafana: "Grafana",
  datadog: "Datadog", gitlab: "GitLab", circleci: "CircleCI", argocd: "Argo CD", helm: "Helm", docker: "Docker", python: "Python",
  javascript: "JavaScript", react: "React", flask: "Flask", postgresql: "PostgreSQL", aws: "AWS", linux: "Linux", nginx: "Nginx",
  git: "Git", sql: "SQL", go: "Go", scala: "Scala", elasticsearch: "Elasticsearch", sqlite: "SQLite", oracle: "Oracle",
  firebase: "Firebase", supabase: "Supabase", vercel: "Vercel", heroku: "Heroku", openai: "OpenAI", llm: "LLMs",
  "machine learning": "Machine learning",
};

// ---------------------------------------------------------------------------------------------- the engine

interface Index {
  chunks: Chunk[];
  name: string;
  stop: Set<string>;
  /** term key -> display name */
  keyDisplay: Map<string, string>;
  /** chunk id -> term keys */
  chunkKeys: Map<string, Set<string>>;
  /** BM25 statistics */
  docTokens: Map<string, string[]>;
  idf: Map<string, number>;
  avgLen: number;
}

function termKeys(term: string, stop: Set<string>): string[] {
  const toks = tokens(term);
  const whole = toks.join(" ");
  const keys = whole ? [whole] : [];
  if (toks.length > 1) {
    for (const t of toks) if (t.length >= 3 && !GENERIC.has(t) && !stop.has(t) && t !== "and") keys.push(t);
  }
  return keys;
}

function buildIndex(portfolio: Portfolio): Index {
  const chunks = buildChunks(portfolio);
  const name = portfolio.profile.name;
  const stop = new Set([...BASE_STOP.map(stem), ...tokens(name)]);

  const keyDisplay = new Map<string, string>();
  const exact = new Set<string>(); // keys whose display is a term spelled exactly that way
  const chunkKeys = new Map<string, Set<string>>();
  for (const c of chunks) {
    const set = new Set<string>();
    for (const term of c.terms) {
      const whole = tokens(term).join(" ");
      for (const k of termKeys(term, stop)) {
        set.add(k);
        if (k === whole) {
          // "AWS" beats "AWS EC2" as the label for the key "aws".
          if (!exact.has(k)) {
            keyDisplay.set(k, term);
            exact.add(k);
          }
        } else if (!keyDisplay.has(k)) {
          // Key came from one word of a longer term: label it with that word as written.
          const word = term.split(/[^A-Za-z0-9+#.]+/).find((w) => tokens(w).join(" ") === k);
          keyDisplay.set(k, word ?? k);
        }
      }
    }
    chunkKeys.set(c.id, set);
  }

  // BM25 over each chunk's full text.
  const docTokens = new Map<string, string[]>();
  const df = new Map<string, number>();
  let total = 0;
  for (const c of chunks) {
    const t = tokens([c.title, c.headline, ...c.details, ...c.terms].join(" ")).filter((x) => !stop.has(x));
    docTokens.set(c.id, t);
    total += t.length;
    for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const N = Math.max(chunks.length, 1);
  const idf = new Map<string, number>();
  for (const [w, n] of df) idf.set(w, Math.log(1 + (N - n + 0.5) / (n + 0.5)));

  return { chunks, name, stop, keyDisplay, chunkKeys, docTokens, idf, avgLen: total / N || 1 };
}

function bm25(index: Index, query: string[], chunk: Chunk): { score: number; matched: Set<string> } {
  const doc = index.docTokens.get(chunk.id) ?? [];
  const tf = new Map<string, number>();
  for (const w of doc) tf.set(w, (tf.get(w) ?? 0) + 1);
  const k1 = 1.4;
  const b = 0.75;
  let score = 0;
  const matched = new Set<string>();
  for (const q of new Set(query)) {
    const f = tf.get(q);
    if (!f) continue;
    matched.add(q);
    score += (index.idf.get(q) ?? 0) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / index.avgLen)));
  }
  return { score, matched };
}

const anchorsOf = (chunks: Chunk[]): Source[] => {
  const seen = new Set<Anchor>();
  const out: Source[] = [];
  for (const c of chunks) {
    if (!seen.has(c.anchor)) {
      seen.add(c.anchor);
      out.push({ label: ANCHOR_LABEL[c.anchor], anchor: c.anchor });
    }
  }
  return out;
};

const bullets = (lines: string[]) => lines.map((l) => `• ${l}`).join("\n");
const ofKind = (index: Index, ...kinds: Chunk["kind"][]) => index.chunks.filter((c) => kinds.includes(c.kind));

// ---------------------------------------------------------------------------------------------- intents

const RE = {
  injection:
    /(ignore|disregard|forget|override|bypass).{0,40}(previous|above|prior|earlier|all|your).{0,20}(instruction|rule|prompt|guideline)|system prompt|your (prompt|instructions)|reveal.{0,25}(prompt|instruction|secret|config)|jailbreak|developer mode|pretend (to be|you are)|act as (?!a recruiter)|password|passcode|passphrase|secret|api[ _-]?key|access[ _-]?token|auth(entication)? token|credential|\.env|environment variable|connection string|database (url|password|dump|record)|admin (panel|password|login|access|dashboard|page)|sql injection|drop table/i,
  greeting: /^\s*(hi|hello|hey|hola|namaste|yo|good\s+(morning|afternoon|evening)|sup|help)\b[\s!.?]*$/i,
  help: /\b(what can (you|i)|how (do|does) (this|you)|what (do|can) you (do|know|answer))\b/i,
  about: /\b(who (is|are)|about (him|rahul|yourself|himself|you)\b|introduc|tell me about (him|himself|yourself)|summary of|overview|describe (him|yourself))\b/i,
  education: /\b(educat|degree|college|universit|studied|study|graduat|cgpa|gpa|school|qualification|academic|btech|b\.?e\b|diploma|course)/i,
  contact: /\b(contact|reach|e-?mail|phone|call|whatsapp|linkedin|github|get in touch|message|dm|connect)\b/i,
  resume: /\b(resume|cv|curriculum vitae)\b/i,
  availability: /\b(availab|open to|looking for (a )?(job|role|work|opportunit)|job search|opportunit|notice period|start date|join)\b/i,
  journey: /\b(devops|transition|journey|path|automation|pivot|switch(ed)?|moving into|move into|grow(ing)? into|story|background|career|evolv|why did)\b/i,
  experience: /\b(experience|employ|company|employer|work(ed|ing)? (at|as|for|history)|job|role|responsib|current(ly)?|profession|what does (he|rahul) do|day[- ]to[- ]day|years?)\b/i,
  projects: /\b(project|built|build|built|portfolio|case stud|application|platform|system)s?\b/i,
  skills: /\b(skill|stack|technolog|tools?|language|framework|expertise|proficien|good at|strength|capabilit)/i,
  location: /\b(location|located|based|live[sd]?|city|country|relocat|where is (he|rahul)|from where)\b/i,
  years: /\b(how (many|long)|years? of)\b/i,
};

// ---------------------------------------------------------------------------------------------- answers

function refuse(): Answer {
  return {
    kind: "refusal",
    grounded: false,
    sources: [],
    answer:
      "I can only answer questions about this portfolio: the work, skills, experience, education and career path shown on this site. I don't have access to passwords, keys, admin data or anything outside that content, and I can't change how I work.",
  };
}

function notFound(index: Index, prefix?: string): Answer {
  return {
    kind: "notfound",
    grounded: false,
    sources: [],
    answer: `${prefix ? `${prefix} ` : ""}I couldn't find that in ${index.name}'s portfolio, so I can't answer it. I can help with his projects, skills, experience, education, career path and how to contact him.`,
  };
}

function greeting(index: Index): Answer {
  return {
    kind: "greeting",
    grounded: false,
    sources: [],
    answer: `Hi! I answer questions about ${index.name}'s work using only the content of this portfolio. Try asking about his projects, skills, experience, education or career path.`,
  };
}

function aboutAnswer(index: Index): Answer {
  const c = index.chunks.find((x) => x.kind === "profile");
  if (!c) return notFound(index);
  return { grounded: true, sources: anchorsOf([c]), answer: [c.headline, c.details[0]].filter(Boolean).join("\n\n") };
}

function projectsAnswer(index: Index): Answer {
  const list = ofKind(index, "project");
  if (list.length === 0) return notFound(index, "No projects are listed yet.");
  return {
    grounded: true,
    sources: anchorsOf(list),
    answer: `${index.name} has ${list.length} project${list.length === 1 ? "" : "s"} listed:\n${bullets(list.map((c) => c.headline))}\n\nAsk about any of them for details.`,
  };
}

function projectDetail(c: Chunk): Answer {
  return { grounded: true, sources: anchorsOf([c]), answer: `${c.headline}\n${bullets(c.details)}` };
}

function experienceAnswer(index: Index, q: string): Answer {
  const list = ofKind(index, "experience");
  if (list.length === 0) return notFound(index, "No work experience is listed yet.");
  const note = RE.years.test(q) ? "The portfolio doesn't state a total number of years, so here is the experience it lists:\n" : "";
  const body = list.map((c) => `${c.headline}\n${bullets(c.details.slice(0, 5))}`).join("\n\n");
  return { grounded: true, sources: anchorsOf(list), answer: `${note}${body}` };
}

function skillsAnswer(index: Index): Answer {
  const list = ofKind(index, "skillGroup");
  if (list.length === 0) return notFound(index, "No skills are listed yet.");
  return { grounded: true, sources: anchorsOf(list), answer: `Here are the skills ${index.name} lists:\n${bullets(list.map((c) => c.headline))}` };
}

function educationAnswer(index: Index): Answer {
  const list = ofKind(index, "education");
  if (list.length === 0) return notFound(index, "No education is listed yet.");
  return {
    grounded: true,
    sources: anchorsOf(list),
    answer: list.map((c) => [c.headline, ...c.details].join("\n")).join("\n\n"),
  };
}

function journeyAnswer(index: Index): Answer {
  const story = index.chunks.find((c) => c.kind === "journeyStory");
  const steps = ofKind(index, "milestone");
  if (!story && steps.length === 0) return notFound(index);
  const parts: string[] = [];
  // The story is written in the first person, so introduce it as a quote to keep the voice clear.
  if (story) parts.push(`In ${index.name}'s own words:\n\n${[story.headline, ...story.details].join("\n\n")}`);
  if (steps.length) parts.push(`Milestones:\n${bullets(steps.map((c) => c.headline))}`);
  return { grounded: true, sources: anchorsOf([...(story ? [story] : []), ...steps]), answer: parts.join("\n\n") };
}

function contactAnswer(index: Index, portfolio: Portfolio): Answer {
  const c = index.chunks.find((x) => x.kind === "contact");
  if (!c) return notFound(index, "No contact details are listed yet.");
  const hasResume = Boolean(portfolio.resume.pdf || portfolio.resume.docx);
  return {
    grounded: true,
    sources: anchorsOf([c]),
    answer: `${c.headline}\n${bullets(c.details)}${hasResume ? "\n\nHis resume is available from the Resume button on the home page." : ""}`,
  };
}

function resumeAnswer(index: Index, portfolio: Portfolio): Answer {
  const files = [portfolio.resume.pdf && "PDF", portfolio.resume.docx && "DOCX"].filter(Boolean);
  const src = anchorsOf([{ anchor: "hero" } as Chunk]);
  if (files.length === 0) return { grounded: true, sources: src, answer: `No resume file has been published on this site yet. You can reach ${index.name} through the Contact section.` };
  return {
    grounded: true,
    sources: src,
    answer: `Yes. ${index.name}'s resume is available as ${files.join(" and ")}. Use the Resume button on the home page to view it in your browser or download it.`,
  };
}

function availabilityAnswer(index: Index): Answer {
  const p = index.chunks.find((c) => c.kind === "profile");
  const line = p?.details.find((d) => d.startsWith("Availability: "));
  if (!p || !line) return notFound(index);
  return { grounded: true, sources: anchorsOf([p]), answer: `${line}\nYou can reach him through the Contact section.` };
}

function locationAnswer(index: Index): Answer {
  const p = index.chunks.find((c) => c.kind === "profile");
  const line = p?.details.find((d) => d.startsWith("Based in: "));
  if (!p) return notFound(index);
  return { grounded: true, sources: anchorsOf([p]), answer: line ? `${index.name} is ${line.replace("Based in: ", "based in ")}.` : p.headline };
}

/** Technologies named in the question, split into those found in the portfolio and those that are not. */
function techLookup(index: Index, qTokens: string[]) {
  const padded = ` ${qTokens.join(" ")} `;
  const matchedKeys: string[] = [];
  for (const k of index.keyDisplay.keys()) if (padded.includes(` ${k} `)) matchedKeys.push(k);

  // Keep the most specific keys: drop any key contained in a longer matched key ("aws" inside "aws ec2") only for display purposes.
  const names: string[] = [];
  for (const k of [...matchedKeys].sort((a, b) => b.split(" ").length - a.split(" ").length)) {
    if (!names.some((n) => ` ${normaliseKey(n)} `.includes(` ${k} `))) names.push(index.keyDisplay.get(k) ?? k);
  }

  const missing: string[] = [];
  for (const raw of COMMON_TECH) {
    const key = tokens(raw).join(" ");
    if (!padded.includes(` ${key} `)) continue;
    const canon = TECH_ALIAS[key] ?? key;
    const known = [...index.keyDisplay.keys()].some((k) => k === key || k === canon);
    if (!known) {
      const display = TECH_DISPLAY[canon] ?? TECH_DISPLAY[key] ?? raw;
      if (!missing.includes(display)) missing.push(display);
    }
  }
  return { matchedKeys, names, missing };
}
const normaliseKey = (display: string) => tokens(display).join(" ");

function techAnswer(index: Index, matchedKeys: string[], names: string[], missing: string[]): Answer {
  const parts: string[] = [];
  let chunks: Chunk[] = [];

  if (matchedKeys.length > 0) {
    chunks = index.chunks.filter((c) => {
      const keys = index.chunkKeys.get(c.id);
      return keys ? matchedKeys.some((k) => keys.has(k)) : false;
    });
    const label = names.join(" / ");
    const planned = chunks.filter((c) => c.kind === "milestone" && c.status === "next");
    const current = chunks.filter((c) => !(c.kind === "milestone" && c.status === "next"));

    if (current.length === 0) {
      parts.push(`${label} is listed only as a planned next step in ${index.name}'s career path, not as current experience:\n${bullets(planned.map((c) => c.title))}`);
    } else {
      const lines = chunks.map((c) => {
        switch (c.kind) {
          case "skillGroup":
            return `Skills: ${c.title}`;
          case "project":
            return `Project: ${c.title}`;
          case "experience":
            return `Experience: ${c.title}`;
          case "milestone":
            return `Career path: ${c.title}${c.status === "current" ? " (in progress)" : c.status === "next" ? " (planned next step)" : ""}`;
          default:
            return c.title;
        }
      });
      parts.push(`Yes, ${label} appears in ${index.name}'s portfolio:\n${bullets(lines)}`);
    }
  }

  if (missing.length > 0) {
    parts.push(`I couldn't find ${missing.join(" or ")} in ${index.name}'s portfolio, so I can't say he has experience with ${missing.length > 1 ? "them" : "it"}.`);
  }

  return { grounded: matchedKeys.length > 0, sources: anchorsOf(chunks), answer: parts.join("\n\n") };
}

function rankedAnswer(index: Index, qTokens: string[]): Answer | null {
  const sig = qTokens.filter((t) => !index.stop.has(t));
  if (sig.length === 0) return null;

  const ranked = index.chunks
    .map((c) => ({ c, ...bm25(index, sig, c) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;

  // Require that most of the meaningful words in the question actually occur in the content.
  const covered = new Set<string>();
  for (const r of ranked.slice(0, 3)) r.matched.forEach((m) => covered.add(m));
  const coverage = covered.size / new Set(sig).size;
  if (coverage < 0.6 && covered.size < 2) return null;

  const top = ranked.slice(0, 2).map((r) => r.c);
  return {
    grounded: true,
    sources: anchorsOf(top),
    answer: `Here's what the portfolio says that relates to your question:\n\n${top.map((c) => [c.headline, ...c.details.slice(0, 3)].join("\n")).join("\n\n")}`,
  };
}

/**
 * The short name a visitor would actually type for a project. A title like "InfraDesk: IT Asset Request and Approval System"
 * is called "InfraDesk"; "Admin Portal (Saarthi Platform)" is "Saarthi". Returns the token lists of the part before a colon and
 * the part in brackets (generic words dropped), when the title has them.
 */
function projectAliases(title: string, stop: Set<string>): string[][] {
  const out: string[][] = [];
  const head = title.split(":")[0];
  if (head !== title) out.push(tokens(head));
  const bracket = /\(([^)]+)\)/.exec(title);
  if (bracket) out.push(tokens(bracket[1]));
  return out.map((a) => a.filter((t) => !stop.has(t))).filter((a) => a.length > 0);
}

function findNamedProject(index: Index, qTokens: string[]): Chunk | null {
  const q = new Set(qTokens);
  let best: { c: Chunk; ratio: number; hits: number } | null = null;
  for (const c of ofKind(index, "project")) {
    const title = tokens(c.title).filter((t) => !index.stop.has(t));
    if (title.length === 0) continue;
    // Naming a project by its short name ("Tell me about InfraDesk") counts as naming all of it.
    const alias = projectAliases(c.title, index.stop).find((a) => a.every((t) => q.has(t)));
    if (alias && (!best || best.ratio < 1 || alias.length > best.hits)) {
      best = { c, ratio: 1, hits: alias.length };
      continue;
    }
    const hits = title.filter((t) => q.has(t)).length;
    const ratio = hits / title.length;
    if (hits >= Math.min(2, title.length) && ratio >= 0.5 && (!best || ratio > best.ratio || (ratio === best.ratio && hits > best.hits))) best = { c, ratio, hits };
  }
  return best?.c ?? null;
}

/**
 * The portfolio passages most relevant to a question, as plain text plus their sections. Used as the ONLY context
 * when an LLM is enabled (see llm.ts). The profile is always included so the model knows whose portfolio it is.
 */
export function retrieveContext(portfolio: Portfolio, question: string, limit = 6): { text: string; sources: Source[] } {
  const index = buildIndex(portfolio);
  const sig = tokens(question).filter((t) => !index.stop.has(t));
  const ranked = index.chunks
    .map((c) => ({ c, score: bm25(index, sig, c).score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.c);

  const profile = index.chunks.filter((c) => c.kind === "profile");
  const picked = [...new Set([...profile, ...ranked])].slice(0, limit);
  const NL = String.fromCharCode(10);
  const text = picked
    .map((c) => [`[${ANCHOR_LABEL[c.anchor]}] ${c.headline}`, ...c.details.map((d) => `- ${d}`)].join(NL))
    .join(NL + NL)
    .slice(0, 6000);
  return { text, sources: anchorsOf(picked) };
}

/** Suggested questions built from the current content, so they always have an answer. */
export function suggestQuestions(portfolio: Portfolio): string[] {
  const index = buildIndex(portfolio);
  const n = index.name;
  const out: string[] = [];
  if (portfolio.projects.length) out.push(`What projects has ${n} built?`);

  const counts = new Map<string, { display: string; n: number }>();
  for (const c of index.chunks) for (const t of c.terms) {
    const k = normaliseKey(t);
    const cur = counts.get(k);
    counts.set(k, { display: cur?.display ?? t, n: (cur?.n ?? 0) + 1 });
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (top) out.push(`Does ${n} know ${top.display}?`);

  if (portfolio.experience.length) out.push(`What is ${n}'s work experience?`);
  if (portfolio.journey.milestones.length) out.push(`How has ${n}'s career path evolved?`);
  if (portfolio.education.length) out.push(`Where did ${n} study?`);
  if (portfolio.contacts.length) out.push(`How can I contact ${n}?`);
  return out.slice(0, 6);
}

export function answerQuestion(portfolio: Portfolio, question: string): Answer {
  const index = buildIndex(portfolio);
  const q = question.trim();
  const qTokens = tokens(q);

  if (RE.injection.test(q)) return refuse();
  if (RE.greeting.test(q) || RE.help.test(q)) return greeting(index);
  if (RE.about.test(q) && !RE.projects.test(q.replace(/tell me about/i, ""))) return aboutAnswer(index);

  const named = findNamedProject(index, qTokens);
  if (named) return projectDetail(named);

  const { matchedKeys, names, missing } = techLookup(index, qTokens);
  if (matchedKeys.length > 0 || missing.length > 0) return techAnswer(index, matchedKeys, names, missing);

  if (RE.education.test(q)) return educationAnswer(index);
  if (RE.resume.test(q)) return resumeAnswer(index, portfolio);
  if (RE.availability.test(q)) return availabilityAnswer(index);
  if (RE.contact.test(q)) return contactAnswer(index, portfolio);
  if (RE.journey.test(q)) return journeyAnswer(index);
  if (RE.experience.test(q)) return experienceAnswer(index, q);
  if (RE.projects.test(q)) return projectsAnswer(index);
  if (RE.skills.test(q)) return skillsAnswer(index);
  if (RE.location.test(q)) return locationAnswer(index);

  return rankedAnswer(index, qTokens) ?? notFound(index);
}
