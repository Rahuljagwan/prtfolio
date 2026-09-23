import * as THREE from 'three'

/**
 * THE RAIL — single source of truth.
 *
 * Each station = one portfolio section.
 * `pos`  = where the camera sits
 * `look` = what the camera looks at
 *
 * Tune these numbers freely — everything else (curve, overlay timing,
 * HUD dots, scroll height) derives from this array automatically.
 */
export const STATIONS = [
  {
    id: 'hero',
    side: 'left',
    kicker: 'The Living System',
    title: "Hi, I'm Rahul.",
    body: 'I build systems that stay up. Scroll to follow a request through my world.',
    pos: [-22, 13, 26],
    look: [0, 1, 0],
  },
  {
    id: 'about',
    side: 'right',
    kicker: 'About — The Gate',
    title: 'Every request meets me first.',
    body: 'Nginx reverse proxy, routing, safety. I care about the whole path from browser to database.',
    pos: [-15, 4.5, 9],
    look: [-8, 1.5, 0],
  },
  {
    id: 'journey',
    side: 'left',
    kicker: 'Journey — The Pipeline',
    title: 'From building features to running systems.',
    body: 'Commit → build → test → deploy. My story rides this belt: Flask & React first, then Linux, Docker, AWS and CI/CD.',
    pos: [-4, 5.5, 15],
    look: [-2, 1, 7],
  },
  {
    id: 'projects',
    side: 'right',
    kicker: 'Projects — Server District',
    title: 'Every building is live.',
    body: 'Systems used daily by real teams, not demo apps. Hover a server to see its traffic. (Week 3+)',
    pos: [5, 7.5, 8],
    look: [0, 1.5, -2],
  },
  {
    id: 'skills',
    side: 'left',
    kicker: 'Skills — Monitoring Tower',
    title: 'Watching everything, calmly.',
    body: 'Flask, React, PostgreSQL, AWS, Nginx, Docker. The incident button lives here. (Week 5)',
    pos: [7, 9, -1],
    look: [2, 4, -10],
  },
  {
    id: 'education',
    side: 'right',
    kicker: 'Education — The Vault',
    title: 'Persistent records.',
    body: 'Degrees and certifications — committed to durable storage.',
    pos: [13, 4, 2],
    look: [8, 1.5, -4],
  },
  {
    id: 'contact',
    side: 'center',
    kicker: 'Contact — Deploy Pad',
    title: '200 OK — your turn.',
    body: 'init contact → send. The terminal form arrives in Week 6; for now, this is the end of the rail.',
    pos: [12, 2.8, 11],
    look: [12, 1.2, 6],
  },
]

export const SECTION_COUNT = STATIONS.length

/** Camera position curve — smooth path through every station pos. */
export const cameraCurve = new THREE.CatmullRomCurve3(
  STATIONS.map((s) => new THREE.Vector3(...s.pos)),
  false,
  'centripetal', // centripetal = no weird loops between uneven points
)

/** LookAt curve — what the camera is looking at, also smoothed. */
export const lookCurve = new THREE.CatmullRomCurve3(
  STATIONS.map((s) => new THREE.Vector3(...s.look)),
  false,
  'centripetal',
)
