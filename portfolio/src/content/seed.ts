import type { Portfolio } from "@/lib/types";

// Seed content: the fallback the site shows when the database is unreachable, and what `npm run db:seed` and `npm run db:sync-content` load.
export const seed: Portfolio = {
  // Everything below is taken from the resume (protflio_bkp/resume/resume.html). The wording follows it; nothing is invented. Where the resume
  // is silent (dates for certifications, the period of the freelance work) the text says so with a neutral label instead of a guess.
  profile: {
    name: "Rahul Jagwan",
    role: "Software Engineer",
    headline: "I build full stack and backend web applications, from development to deployment.",
    location: "Mumbai, India",
    availability: "Open to backend, full stack and DevOps roles",
    bio: [
      "I am a Software Engineer at SBFC Finance Limited, building internal enterprise web applications from development to deployment. I work across React frontends, Flask and Node.js backends, MySQL and PostgreSQL databases, and Linux server hosting with Nginx.",
      "I have practical experience with role-based access control, approval workflows, scheduled background jobs, secure session handling and automated testing. I am looking for backend, full stack or DevOps-oriented software engineering roles.",
    ],
    facts: [
      { label: "Based in", value: "Mumbai, Maharashtra, India" },
      { label: "Working at", value: "SBFC Finance Limited" },
      { label: "Focus", value: "Full stack and backend, with Linux deployment" },
      { label: "Core stack", value: "Python, Flask, Node.js, React" },
    ],
    highlights: [
      { title: "Built end to end", text: "Internal enterprise applications taken from development to deployment: React, Flask or Node.js, and Linux with Nginx." },
      { title: "Secure by design", text: "Role-based access, session timeouts, account lockout and rate limiting, and security review findings (XSS, CSRF, IDOR) closed." },
      { title: "Tested and documented", text: "Playwright and pytest coverage, SIT and UAT support, and handover and rollback documentation." },
    ],
  },

  // The resume's own contact line is placeholders (phone, email, LinkedIn, GitHub), so these stay placeholders until real ones are entered in /admin.
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
      organisation: "SBFC Finance Limited",
      period: "Dec 2025 – Present",
      location: "Mumbai, Maharashtra, India (On-site, Full-time)",
      bullets: [
        "Develop and maintain full stack web applications across frontend and backend systems to support business requirements, including asset management, compliance training, legal notice management and branch operations.",
        "Manage application deployment, server hosting, configuration and performance optimization using Linux, Nginx, PM2, Gunicorn, systemd, cron jobs, WebSockets, PWA features, secure remote server management and Amazon S3.",
        "Implement role-based access control, session timeouts, account lockout, password policies and rate limiting, and work on closing security review findings such as XSS, CSRF and insecure direct object references.",
        "Contribute to testing, debugging, troubleshooting and improving application stability and reliability using Playwright and pytest; support SIT and UAT cycles and prepare handover and rollback documentation.",
      ],
      stack: ["Flask", "Node.js", "React", "MySQL", "PostgreSQL", "Linux", "Nginx", "Gunicorn", "PM2", "systemd", "Amazon S3", "Playwright", "pytest"],
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

  // The resume's Technical Skills, in its own words. Ordered the way the Skills section reads them: from what people see (the frontend) down to
  // where it runs (cloud and devops), then what cuts across all of it (testing and security, the languages, the working practices).
  skillGroups: [
    { id: "sg-1", name: "Frontend", skills: ["React.js", "Next.js", "Redux Toolkit", "RTK Query", "HTML5", "CSS3", "Bootstrap", "Tailwind CSS", "Material UI", "Shadcn", "Progressive Web Apps (PWA)"] },
    { id: "sg-2", name: "Backend", skills: ["Flask", "Node.js", "Express.js", "REST APIs", "WebSockets", "JWT authentication", "Role-Based Access Control (RBAC)", "SQLAlchemy", "Swagger / OpenAPI", "Strapi"] },
    { id: "sg-3", name: "Databases", skills: ["MySQL", "PostgreSQL", "MongoDB", "Redis", "Firebase"] },
    { id: "sg-4", name: "Cloud & DevOps", skills: ["Linux", "Nginx", "Gunicorn", "PM2", "systemd", "Docker", "Docker Compose", "Git", "GitHub", "Cron Jobs", "Amazon S3", "AWS Bedrock", "Server configuration and deployment"] },
    { id: "sg-5", name: "Testing & Security", skills: ["Playwright", "pytest", "Postman", "Debugging and troubleshooting", "Session management", "Rate limiting", "XSS / CSRF / IDOR remediation", "VAPT findings closure"] },
    { id: "sg-6", name: "Languages", skills: ["Python", "JavaScript (ES6+)", "TypeScript", "Java", "C++", "SQL"] },
    { id: "sg-7", name: "Practices", skills: ["SDLC", "Agile collaboration", "SIT / UAT support", "Technical documentation", "Cross-functional teamwork"] },
  ],

  // The degree, then the resume's Certifications. The resume gives the degree years and the CGPA, and no dates for the certifications.
  education: [
    {
      id: "edu-1",
      degree: "Bachelor of Engineering in Computer Science",
      institution: "Universal College of Engineering, Mumbai",
      period: "2021 – 2025",
      description: "CGPA: 8.7.",
    },
    {
      id: "edu-2",
      degree: "Software Engineering Job Simulation",
      institution: "J.P. Morgan (virtual internship)",
      period: "Certification",
      description: null,
    },
    {
      id: "edu-3",
      degree: "Advanced Software Engineering Job Simulation",
      institution: "Walmart (virtual internship)",
      period: "Certification",
      description: null,
    },
    {
      id: "edu-4",
      degree: "Courses and training",
      institution: "Udemy and Code Unnati",
      period: "Certification",
      description: "Complete JavaScript (Udemy), Machine Learning (Udemy) and SAP Training (Code Unnati).",
    },
  ],

  // The path is told from the resume's own timeline: the degree, the job simulations and courses, the freelance projects, the current role,
  // and the roles it is looking for next.
  journey: {
    heading: "From full stack projects to production systems.",
    story: [
      "I studied Computer Science at Universal College of Engineering in Mumbai, and I built freelance projects in the MERN stack: a Goods Management module for a logistics platform, a role-based dashboard for shop owners and a CVE management dashboard.",
      "Since December 2025 I have been a Software Engineer at SBFC Finance Limited, where the work goes all the way to production: Flask and Node.js backends, React frontends, and hosting on Linux with Nginx, Gunicorn, PM2 and systemd, along with role-based access, scheduled jobs, security review fixes and automated tests. I am now looking for backend, full stack or DevOps-oriented software engineering roles.",
    ],
    milestones: [
      {
        id: "ms-1",
        title: "Computer science foundations",
        period: "2021 – 2025",
        description: "Bachelor of Engineering in Computer Science at Universal College of Engineering, Mumbai, with a CGPA of 8.7.",
        tags: [],
        status: "done",
      },
      {
        id: "ms-2",
        title: "Job simulations and courses",
        period: "Certifications",
        description: "Completed the Software Engineering job simulation with J.P. Morgan and the Advanced Software Engineering job simulation with Walmart (both virtual internships), plus Udemy courses in JavaScript and Machine Learning and SAP training with Code Unnati.",
        tags: ["J.P. Morgan", "Walmart", "Udemy"],
        status: "done",
      },
      {
        id: "ms-3",
        title: "Freelance full stack projects",
        period: "Freelance",
        description: "Built DellCube (goods management for a logistics platform), JMD (a dashboard for shop owners) and CVEarity (CVE management) on the MERN stack with Redux Toolkit and RTK Query.",
        tags: ["MongoDB", "Express", "React", "Node.js", "Redux Toolkit"],
        status: "done",
      },
      {
        id: "ms-4",
        title: "Software Engineer at SBFC Finance Limited",
        period: "Dec 2025 – Present",
        description: "Building internal enterprise web applications from development to deployment, across asset management, compliance training, legal notice management and branch operations.",
        tags: ["Flask", "Node.js", "React", "MySQL", "PostgreSQL"],
        status: "current",
      },
      {
        id: "ms-5",
        title: "Backend, full stack and DevOps roles",
        period: "Next",
        description: "Looking for backend, full stack or DevOps-oriented software engineering roles.",
        tags: [],
        status: "next",
      },
    ],
  },

  // Resume files are uploaded from /admin, so there is nothing to seed.
  resume: {},
};
