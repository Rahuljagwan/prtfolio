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

  projects: [
    {
      id: "proj-1",
      title: "Enterprise NBFC Workflow Platform",
      summary:
        "A finance and workflow management system that moves requests through approval stages with clear ownership and an audit trail.",
      role: "Full-stack development and deployment",
      highlights: [
        "Multi-stage approval workflows with role-based access",
        "Reverse-proxied production deployment on AWS EC2",
        "Scheduled jobs for reminders and escalations",
      ],
      stack: ["Flask", "Gunicorn", "React", "Vite", "Nginx", "PostgreSQL", "AWS EC2"],
      challenge:
        "Approval requests were tracked across email threads and spreadsheets, so it was hard to see who owned a request or where it had stalled.",
      approach: ["Modelled each request as a workflow with explicit stages, owners and role-based permissions.", "Built the Flask API and React interface around that model, with an audit trail for every state change.", "Deployed behind Nginx with Gunicorn on AWS EC2, and added scheduled jobs for reminders and escalations."],
      outcome: "Requests now move through defined stages with clear ownership, and every decision leaves a record that can be reviewed later.",
    },
    {
      id: "proj-2",
      title: "HR Management System",
      summary:
        "An employee lifecycle and HR operations platform covering records, requests and day-to-day HR processes in one place.",
      role: "Full-stack development",
      highlights: [
        "Employee records and request handling",
        "Role-aware views for HR, managers and staff",
        "Reports and exports for HR teams",
      ],
      stack: ["Flask", "React", "PostgreSQL"],
      challenge:
        "HR processes were spread across separate files and manual follow-ups, with no single place for an employee record or its requests.",
      approach: ["Designed a shared employee data model and the request flows that hang off it.", "Built role-aware views so HR, managers and staff each see only what they should.", "Added reports and exports for the recurring questions HR teams ask."],
      outcome: "HR work runs from one system, with the right access for each role and consistent records.",
    },
    {
      id: "proj-3",
      title: "Document Custody Platform",
      summary:
        "A secure system for storing, tracking and managing important documents, with controlled access and a clear record of who handled what.",
      role: "Full-stack development",
      highlights: [
        "Controlled access to sensitive documents",
        "Movement tracking with a full history",
        "Secure file storage",
      ],
      stack: ["Flask", "React", "PostgreSQL", "AWS"],
      challenge:
        "Important physical and digital documents changed hands without a reliable record of who held what, or when.",
      approach: ["Defined a custody model where every handover is an event with a person, a time and a reason.", "Added controlled access and secure file storage for sensitive documents.", "Built a full movement history so any document can be traced end to end."],
      outcome: "Each document has a complete, reviewable history, and access is limited to the people who need it.",
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
