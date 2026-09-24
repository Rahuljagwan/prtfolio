import type { Portfolio } from "@/lib/types";

// Seed content. Stage 3 moves this into Postgres; until then it is the only place content lives.
export const seed: Portfolio = {
  profile: {
    name: "Rahul",
    role: "Full-Stack Developer",
    headline: "I build and run production web systems, and I am growing into DevOps.",
    location: "Delhi, India",
    availability: "Open to new opportunities",
    bio: [
      "I am a full-stack developer working with Flask and React. My day-to-day is building business applications for an enterprise finance company and keeping them running in production.",
      "That means I care about the whole path: clean APIs, a usable interface, a safe deployment, and knowing what to do when something breaks at an inconvenient hour. I am now moving deeper into DevOps, with a focus on Linux, AWS and repeatable deployments.",
    ],
    facts: [
      { label: "Based in", value: "Delhi, India" },
      { label: "Focus", value: "Full-stack, moving into DevOps" },
      { label: "Core stack", value: "Flask, React, PostgreSQL, AWS" },
    ],
    highlights: [
      { title: "Production experience", text: "Systems used daily by real teams, not demo apps." },
      { title: "Deployment ownership", text: "Nginx, Gunicorn and AWS EC2 set up and maintained end to end." },
      { title: "Calm under incidents", text: "Practised at tracing a failure to its cause and restoring service." },
    ],
  },

  contacts: [
    { type: "email", value: "rahul@example.com" },
    { type: "phone", value: "+91-XXXXXXXXXX" },
    { type: "whatsapp", value: "+91-XXXXXXXXXX" },
    { type: "linkedin", value: "linkedin.com/in/placeholder" },
    { type: "github", value: "github.com/placeholder" },
  ],

  experience: [
    {
      id: "exp-1",
      role: "Software Engineer",
      organisation: "Enterprise NBFC / Fintech",
      period: "Dec 2025 – Present",
      location: "India",
      bullets: [
        "Build and maintain full-stack internal applications for finance and operations teams, from database design to the user interface.",
        "Deploy and host applications on AWS EC2 with Gunicorn and an Nginx reverse proxy, including configuration and performance tuning.",
        "Handle production incidents: investigate logs, find the root cause and restore service, then document the fix.",
        "Add role-based access control, session security and scheduled background jobs to keep systems safe and dependable.",
      ],
      stack: ["Flask", "React", "PostgreSQL", "Nginx", "AWS EC2", "Linux"],
    },
  ],

  // Projects are taken from the resume (resume/resume.html). Wording follows it; nothing here is invented. Fields the resume does
  // not state (status, dates, metrics, links) are simply absent. Extra structured fields live in content/projects-meta.ts.
  projects: [
    {
      id: "proj-saarthi",
      title: "Admin Portal (Saarthi Platform)",
      summary: "An internal branch operations portal: branch creation with an approval workflow, quotations, lease and asset trackers, and compliance and bullion modules.",
      role: "Software Engineer, SBFC Finance Limited",
      highlights: [
        "Branch creation with an approval workflow, plus quotation, lease and asset trackers",
        "Expiry and renewal notification engine: daily scheduled generation, email delivery, job locking, no duplicates",
        "Scope-based data access, single-session control and token-based email approvals",
      ],
      stack: ["Flask", "Flask-RESTX (Swagger)", "SQLAlchemy", "MySQL", "React", "Vite", "Tailwind CSS", "Amazon S3", "Gunicorn"],
      challenge: null,
      approach: [
        "Worked on an internal branch operations portal covering branch creation with approval workflow, quotation management, lease and asset trackers, and compliance and bullion modules.",
        "Built an expiry and renewal notification engine with scheduled daily generation, email delivery, job locking and duplicate prevention, with pytest coverage for the notification logic.",
        "Applied scope-based data access, single-session control and token-based email approvals to keep access restricted to the right users and branches.",
      ],
      outcome: null,
    },
    {
      id: "proj-infradesk",
      title: "InfraDesk: IT Asset Request and Approval System",
      summary: "A multi-stage approval system (Manager, IT, Admin Dispatch) for IT asset requests, transfers, allocations, replacements and handovers, with secure approve / reject links sent by email.",
      role: "Software Engineer, SBFC Finance Limited",
      highlights: [
        "Three-stage approval flow with secure approve / reject links in email",
        "Multi-role access with role switching, per-role rate limits, idle and absolute session timeouts",
        "SLA escalation script, user access management with audit tables, HR system API integration",
      ],
      stack: ["Flask", "MySQL", "Redis", "Flask-SocketIO", "Flask-Limiter", "React", "Tailwind CSS", "Amazon S3", "Gunicorn", "systemd"],
      challenge: null,
      approach: [
        "Built a multi-stage approval workflow (Manager, IT, Admin Dispatch) for new asset requests, transfers, allocations, replacements and handovers, with secure approve / reject links sent by email.",
        "Implemented multi-role access control with role switching, per-role rate limits, idle and absolute session timeouts and server-side session invalidation; also added an SLA escalation script and a user access management module with audit tables.",
        "Integrated the company HR system API for employee data and deployed the backend as a systemd-managed Gunicorn service.",
      ],
      outcome: null,
    },
    {
      id: "proj-soochna",
      title: "Soochna: Legal Notice Management System",
      summary: "A notice lifecycle system covering intake, owner assignment, SLA reminders, overdue alerts, a multi-level escalation chain, closure approval and a full audit trail.",
      role: "Software Engineer, SBFC Finance Limited",
      highlights: [
        "PostgreSQL schema split by domain: auth, master, workflow and transaction",
        "Data-driven, deny-by-default permission model with role rights stored in the database",
        "Security review fixes: content-based file validation, object-level authorization, CSRF protection, input sanitization, security headers",
      ],
      stack: ["Node.js", "Express", "TypeScript", "PostgreSQL", "Zod", "JWT", "React", "Vite", "Tailwind CSS", "Docker", "Nginx", "Amazon S3"],
      challenge: null,
      approach: [
        "Built a notice lifecycle system covering intake, owner assignment, SLA reminders, overdue alerts, a multi-level escalation chain, closure approval and a full audit trail, using a PostgreSQL schema split by domain (auth, master, workflow, transaction).",
        "Designed a data-driven, deny-by-default permission model with role rights stored in the database, and added an hourly SLA sweep job.",
        "Addressed security review findings: file validation by content, object-level authorization checks, CSRF protection, input sanitization against stored XSS and security headers. Wrote automated tests with the Node test runner and a Postman collection.",
      ],
      outcome: null,
    },
    {
      id: "proj-sakshar",
      title: "Sakshar: Compliance Training Platform",
      summary: "A platform where admins assign training modules to employees, who complete videos and quizzes and receive PDF certificates.",
      role: "Software Engineer, SBFC Finance Limited",
      highlights: [
        "Bulk module upload and assignment, recurring reassignment and a daily reminder job",
        "Admin dashboards and audit export",
        "An AWS Bedrock agent generates quiz questions",
      ],
      stack: ["Flask", "SQLAlchemy", "MySQL", "Flask-JWT-Extended", "APScheduler", "ReportLab", "Amazon S3", "AWS Bedrock", "React", "Recharts"],
      challenge: null,
      approach: [
        "Developed a platform where admins assign training modules to employees, who complete videos and quizzes and receive PDF certificates.",
        "Added bulk module upload and assignment, recurring reassignment, a daily reminder job, admin dashboards and audit export.",
        "Implemented password history, account lockout and single active session per user; integrated an AWS Bedrock agent to generate quiz questions.",
      ],
      outcome: null,
    },
    {
      id: "proj-print-tracker",
      title: "Print Tracker: Print Usage Analytics Dashboard",
      summary: "APIs and a dashboard showing print volume, per-user and per-printer usage, top users and usage trends from print log data.",
      role: "Software Engineer, SBFC Finance Limited",
      highlights: [
        "Redis response cache with an in-memory fallback and per-endpoint expiry times",
        "Cursor-based pagination and database indexes to keep dashboard queries responsive",
      ],
      stack: ["Flask", "PostgreSQL (psycopg connection pool)", "Redis", "React", "Vite", "Recharts", "Docker", "Gunicorn", "systemd"],
      challenge: null,
      approach: [
        "Built APIs and a dashboard showing print volume, per-user and per-printer usage, top users and usage trends from print log data.",
        "Added a Redis response cache with an in-memory fallback and per-endpoint expiry times, cursor-based pagination and database indexes to keep dashboard queries responsive.",
      ],
      outcome: null,
    },
    {
      id: "proj-dellcube",
      title: "DellCube: Goods Management for a Logistics Platform",
      summary: "The Goods Management module of a logistics platform, built as a freelance project: full CRUD, dynamic item masters, server-side pagination, debounced search and detail drawers.",
      role: "Freelance developer",
      highlights: ["Dynamic item masters", "Server-side pagination and debounced search", "Drawer-based detail views, API integration through Redux Toolkit Query"],
      stack: ["MongoDB", "Express", "React.js", "Node.js", "Redux Toolkit", "RTK Query", "Cloudinary", "Toastify"],
      challenge: null,
      approach: ["Built the Goods Management module of a logistics platform with CRUD, dynamic item masters, server-side pagination, debounced search and detail drawers."],
      outcome: null,
    },
    {
      id: "proj-jmd",
      title: "JMD: Role-based Dashboard for Shop Owners",
      summary: "A role-based dashboard for shop owners to manage daily operations: order booking, employee management, salary, stock handling and analytics widgets. A freelance project.",
      role: "Freelance developer",
      highlights: ["Order booking, employee management, salary generation and stock handling", "Analytics widgets for bookings, orders, deliveries and pending orders", "Role-based access"],
      stack: ["MongoDB", "Express", "React.js", "Node.js", "Redux Toolkit", "RTK Query", "Cloudinary", "Toastify"],
      challenge: null,
      approach: ["Built a role-based dashboard for shop owners covering order booking, employee management, salary, stock handling and analytics widgets."],
      outcome: null,
    },
    {
      id: "proj-cvearity",
      title: "CVEarity: CVE Management Dashboard",
      summary: "A role-based dashboard for managing CVEs, with log viewing, search, sort and filtering by severity. A freelance project.",
      role: "Freelance developer",
      highlights: ["Log viewing with search, sort and filtering by severity", "Role-based access"],
      stack: ["React.js", "Redux Toolkit", "RTK Query", "Cloudinary", "Toastify", "Tailwind CSS"],
      challenge: null,
      approach: ["Built a role-based dashboard for CVE management with log viewing, search, sort and filtering by severity."],
      outcome: null,
    },
  ],

  skillGroups: [
    { id: "sg-1", name: "Frontend", skills: ["React", "JavaScript", "HTML & CSS", "Tailwind CSS"] },
    { id: "sg-2", name: "Backend", skills: ["Python", "Flask", "REST APIs", "PostgreSQL"] },
    { id: "sg-3", name: "DevOps & Cloud", skills: ["Docker", "AWS (EC2)", "Nginx", "Linux", "Git", "CI/CD"] },
  ],
  education: [
    {
      id: "edu-1",
      degree: "Bachelor of Engineering, Computer Science",
      institution: "Universal College of Engineering",
      period: "2021 – 2025",
      description: "Core computer science coursework with a focus on software development, databases and web technologies. CGPA 8.7.",
    },
  ],

  journey: {
    heading: "From building features to running systems.",
    story: [
      "I started as a full-stack developer, writing Flask APIs and React interfaces for business applications. The work felt complete when the feature worked on my machine.",
      "Then those applications went into production, and the questions changed. How does it get deployed safely? What happens when it fails at night? Can the next release be one command instead of an afternoon? Answering those pulled me toward Linux, Docker, AWS and CI/CD, and I have been building that side of the craft ever since.",
    ],
    milestones: [
      {
        id: "ms-1",
        title: "Full-stack foundations",
        period: "Where it started",
        description: "Built web applications end to end with Flask and React, designing REST APIs and PostgreSQL schemas.",
        tags: ["Flask", "React", "PostgreSQL"],
        status: "done",
      },
      {
        id: "ms-2",
        title: "First production deployments",
        period: "Going live",
        description: "Moved applications onto AWS EC2 behind Gunicorn and an Nginx reverse proxy, and learned what real traffic does to assumptions.",
        tags: ["AWS EC2", "Nginx", "Gunicorn"],
        status: "done",
      },
      {
        id: "ms-3",
        title: "Owning operations",
        period: "Keeping it running",
        description: "Took on Linux server management, log investigation and incident response, restoring service and documenting the fix.",
        tags: ["Linux", "systemd", "Incident response"],
        status: "done",
      },
      {
        id: "ms-4",
        title: "Automating the path to production",
        period: "Now",
        description: "Packaging services with Docker and replacing manual release steps with repeatable CI/CD pipelines.",
        tags: ["Docker", "CI/CD", "AWS"],
        status: "current",
      },
      {
        id: "ms-5",
        title: "Deeper cloud and observability",
        period: "Next",
        description: "Going further on AWS and on monitoring, so problems are caught before users notice them.",
        tags: ["AWS", "Monitoring"],
        status: "next",
      },
    ],
  },

  // Resume files are uploaded from /admin, so there is nothing to seed.
  resume: {},
};
