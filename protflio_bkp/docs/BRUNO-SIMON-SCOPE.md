# A full Bruno-Simon-style 3D world: honest scope

Short version: it is a different kind of project from this portfolio, not an upgrade to it. It can be done, but for a job
search it is usually not worth the cost. These are estimates from experience with this kind of build, not quotes. Ranges are wide
on purpose because the biggest variable is 3D art, not code.

## What the reference actually is

bruno-simon.com is a drivable 3D world: a physics-driven car, a hand-built environment with baked lighting, sound, mobile
controls, and each portfolio "section" placed as a place in the world. It is the result of years of Three.js practice,
a 3D artist's eye, and a lot of iteration. It is famous because very few sites are built like it.

## What it would take (for a solid, polished version)

| Piece | What it involves | Rough effort (one experienced dev) |
|---|---|---|
| 3D assets | Modelling the car, terrain, props and 4 to 6 themed zones in Blender; texturing; baking lighting into textures | 40% to 60% of the whole project. Weeks, and needs real modelling skill or a paid artist |
| Physics and driving | Rapier or cannon-es, vehicle controller, collisions, camera follow, reset/respawn | 1 to 2 weeks |
| Interaction design | Zones that open your projects, experience, resume and contact as in-world objects | 1 to 2 weeks |
| Controls | Keyboard, gamepad, and a usable touch scheme for phones | 1 week |
| Loading and performance | Model compression (Draco/Meshopt), texture compression (KTX2), progress screen, quality tiers, low-end fallback | 1 to 2 weeks |
| Sound and polish | Engine, ambience, UI sounds, particle effects, transitions | 1 week |
| Accessibility and SEO fallback | A parallel plain-HTML version so the content is readable, indexable and keyboard-accessible | 1 week |
| Testing across devices | Many GPUs, browsers, phones | Ongoing |

**Realistic total:**
- Small, charming version (one compact island, a simple car, 4 to 5 zones, simple art): about 4 to 8 weeks full-time.
- Bruno-level polish: 3 to 6 months full-time, or more.
- If you also need to learn Blender and physics from scratch, add a lot: many people take months just to get comfortable.

## Trade-offs to weigh

- **Performance:** first load is typically 5 to 30 MB of assets versus about 0.6 MB now. Lighthouse performance usually lands
  in the 30s to 60s, and it is heavy on phones and old laptops. This portfolio scores 99 to 100 on desktop today.
- **Recruiters and time:** most reviewers spend well under a minute and want to find projects, skills and contact details
  fast. A world you must drive through slows that down and some will bounce. It is memorable, but it can cost you
  conversions on the boring-but-important path.
- **Accessibility and SEO:** a canvas is invisible to search engines and screen readers. You must maintain a full HTML
  version of the same content, which doubles the content work.
- **Maintenance:** every new project or job means updating 3D scenes, not editing a form in `/admin`. Your CMS advantage disappears
  for anything placed in the world.
- **Risk:** it is easy to spend weeks and end with something that feels like a tech demo rather than a portfolio.

## What this project already gives you instead

The current site keeps one cohesive 3D accent (the hero), scroll storytelling, page transitions and micro-interactions,
while staying fast, accessible, indexable and fully editable. That is the sweet spot for most developer job searches.

## If you still want it, a sensible way to do it

1. Keep this portfolio as the default site. Never replace it.
2. Build the world as a separate route or repo (for example `/world`) and link to it from the hero as an optional
   "explore in 3D" button.
3. Start small: one island, one car, three zones (Projects, Experience, Contact). Ship that, then decide whether to grow it.
4. Budget for art: buy or commission a low-poly asset pack rather than modelling everything.
5. Load it lazily and only on capable desktop devices, with the classic site as the automatic fallback.

## My recommendation

For a job search focused on backend, full-stack and DevOps roles, do not build it now. The time is better spent on
case studies, real project depth and applications. Consider a small `/world` experiment later if you are targeting
creative-technology or front-end/graphics roles, or simply want it as a passion project.
