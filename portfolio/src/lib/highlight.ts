// A tiny, dependency-free syntax highlighter for the config gallery (nginx, systemd/ini, yaml, shell). It is a scanner, not a
// parser: good enough to colour comments, strings, numbers, directives and keys, and it is lossless (the tokens of a line
// always join back to exactly that line). Tested in scripts/engineering-check.ts.

export type Lang = "nginx" | "ini" | "yaml" | "bash";
export type TokenKind = "comment" | "string" | "keyword" | "number" | "key" | "punct" | "plain";
export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS: Record<Lang, RegExp> = {
  nginx: /^(on|off|unix|http|https|fail_timeout|expires|default_server)\b/,
  ini: /^(true|false|yes|no|on|off)\b/i,
  yaml: /^(true|false|null|yes|no|on)\b/,
  bash: /^(if|then|else|fi|for|do|done|case|esac|export|set|sudo|cd|echo)\b/,
};

function scan(text: string, lang: Lang): Token[] {
  const out: Token[] = [];
  const push = (kind: TokenKind, t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind === "plain") last.text += t;
    else out.push({ kind, text: t });
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const prev = i === 0 ? " " : text[i - 1];
    let m: RegExpExecArray | null;

    if (rest[0] === "#" && /\s|^$/.test(prev)) {
      push("comment", rest);
      break;
    }
    if ((m = /^"(?:[^"\\]|\\.)*"?|^'(?:[^'\\]|\\.)*'?/.exec(rest))) {
      push("string", m[0]);
      i += m[0].length;
      continue;
    }
    if (/\W/.test(prev) && (m = /^\d+(?:\.\d+)*[a-zA-Z%]*\b/.exec(rest))) {
      push("number", m[0]);
      i += m[0].length;
      continue;
    }
    if (/\W/.test(prev) && (m = KEYWORDS[lang].exec(rest))) {
      push("keyword", m[0]);
      i += m[0].length;
      continue;
    }
    if (/^[{}[\]();,=:\-|>]/.test(rest)) {
      push("punct", rest[0]);
      i++;
      continue;
    }
    // A run of ordinary characters up to the next thing that could start a token.
    m = /^[^\s"'#{}[\]();,=:\-|>]+|^\s+|^./.exec(rest);
    const t = m ? m[0] : rest[0];
    push("plain", t);
    i += t.length;
  }
  return out;
}

/** Highlights one line. The leading directive (nginx), key (ini, yaml) or [section] (ini) is marked as a key. */
export function highlightLine(line: string, lang: Lang): Token[] {
  const indent = /^\s*/.exec(line)?.[0] ?? "";
  const body = line.slice(indent.length);
  const head: Token[] = indent ? [{ kind: "plain", text: indent }] : [];
  if (!body) return head;
  if (body.startsWith("#")) return [...head, { kind: "comment", text: body }];

  let m: RegExpExecArray | null;
  if (lang === "ini" && (m = /^\[[^\]]+\]/.exec(body))) return [...head, { kind: "keyword", text: m[0] }, ...scan(body.slice(m[0].length), lang)];
  if (lang === "ini" && (m = /^([A-Za-z][\w-]*)(\s*=)/.exec(body))) return [...head, { kind: "key", text: m[1] }, { kind: "punct", text: m[2] }, ...scan(body.slice(m[0].length), lang)];
  if (lang === "yaml" && (m = /^(-\s+)?([A-Za-z_][\w.-]*)(\s*:)(?=\s|$)/.exec(body))) {
    return [...head, ...(m[1] ? [{ kind: "punct" as const, text: m[1] }] : []), { kind: "key", text: m[2] }, { kind: "punct", text: m[3] }, ...scan(body.slice(m[0].length), lang)];
  }
  if (lang === "yaml" && (m = /^-\s+/.exec(body))) return [...head, { kind: "punct", text: m[0] }, ...scan(body.slice(m[0].length), lang)];
  if (lang === "nginx" && (m = /^[a-z_]+(?=[\s{;])/.exec(body))) return [...head, { kind: "key", text: m[0] }, ...scan(body.slice(m[0].length), lang)];
  return [...head, ...scan(body, lang)];
}

export function highlight(code: string, lang: Lang): Token[][] {
  return code.split("\n").map((line) => highlightLine(line, lang));
}
