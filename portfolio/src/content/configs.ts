import type { Lang } from "@/lib/highlight";

// Sanitised, illustrative configuration files for the config gallery. They are examples of the kind of thing this work
// involves, not copies of any real system's files: hostnames, paths and names are made up on purpose. Every entry is
// sample: true, so the page marks each one "Sample" until it is replaced with the author's own.

export interface ConfigExample {
  id: string;
  title: string;
  filename: string;
  lang: Lang;
  /** What it is for, in a sentence. */
  blurb: string;
  code: string;
  /** Notes on specific lines (1-based). */
  notes: { line: number; text: string }[];
  /** The project this illustrates, by slug, if any. */
  project?: string;
  sample: true;
}

export const CONFIGS: ConfigExample[] = [
  {
    id: "nginx-reverse-proxy",
    title: "Nginx in front of Gunicorn",
    filename: "/etc/nginx/conf.d/app.conf",
    lang: "nginx",
    blurb: "A reverse proxy that serves static files itself and hands everything else to the application server over a Unix socket.",
    project: "soochna",
    code: `upstream app_server {
    server unix:/run/gunicorn/app.sock fail_timeout=0;
}

server {
    listen 80;
    server_name app.example.internal;

    client_max_body_size 10m;

    # Static files never touch the application.
    location /static/ {
        alias /srv/app/static/;
        expires 7d;
    }

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_pass http://app_server;
    }
}`,
    notes: [
      { line: 2, text: "A Unix socket instead of a port: nothing to expose, and only local processes can reach the app server." },
      { line: 6, text: "Plain HTTP on purpose. In a real setup TLS is added here (certbot) or terminated at a load balancer in front." },
      { line: 9, text: "Uploads over 10 MB are refused at the proxy, before they cost the application anything." },
      { line: 12, text: "Static files are served straight from disk, with a week of caching." },
      { line: 18, text: "Without these headers the app sees every request as coming from the proxy. X-Forwarded-For and -Proto restore the real client and scheme." },
    ],
    sample: true,
  },
  {
    id: "gunicorn-systemd",
    title: "Gunicorn as a systemd service",
    filename: "/etc/systemd/system/gunicorn.service",
    lang: "ini",
    blurb: "Runs the application server as a managed service: started on boot, restarted if it dies, one place to read its logs.",
    project: "infradesk",
    code: `[Unit]
Description=Gunicorn for the approvals app
After=network.target

[Service]
User=app
Group=www-data
WorkingDirectory=/srv/app
RuntimeDirectory=gunicorn
ExecStart=/srv/app/venv/bin/gunicorn --workers 3 --bind unix:/run/gunicorn/app.sock wsgi:app
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target`,
    notes: [
      { line: 6, text: "A dedicated, unprivileged user. If the app is compromised, it is not root." },
      { line: 9, text: "systemd creates /run/gunicorn for the socket and removes it on stop, so there is no stale socket file to trip over." },
      { line: 10, text: "Three workers is a starting point (a common rule is 2 x cores + 1); measure before tuning." },
      { line: 11, text: "Restart on failure with a short pause: a crash loop shows up in the journal instead of hammering the box." },
    ],
    sample: true,
  },
  {
    id: "ci-workflow",
    title: "A minimal CI workflow",
    filename: ".github/workflows/ci.yml",
    lang: "yaml",
    blurb: "Runs the tests on every pull request and on every push to main, so a broken change is caught before it is merged.",
    code: `name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pytest -q`,
    notes: [
      { line: 2, text: "Both triggers: pull requests get feedback early, and main is re-tested after the merge." },
      { line: 11, text: "Actions are pinned to a major version tag. Pinning to a full commit hash is stricter, at the cost of manual updates." },
      { line: 14, text: "The version is stated, not inherited: the runner's default Python can change under you." },
    ],
    sample: true,
  },
];
