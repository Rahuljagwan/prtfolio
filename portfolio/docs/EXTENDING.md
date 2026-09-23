# Extending the CMS

## Add a field to an existing item (e.g. a "Live URL" on projects)

1. `prisma/schema.prisma`: add `liveUrl String?` to `model Project`.
2. `npm run db:migrate` (name it something like `project_live_url`).
3. `src/lib/admin/resources.ts`: add to the projects `fields` array:
   ```ts
   { name: "liveUrl", label: "Live URL", type: "text", max: 300 },
   ```
   The edit form and API validation now include it. (Required by default. For an optional field, make it a
   `list` or relax the schema in `schemaFor`.)
4. `src/lib/types.ts`: add `liveUrl?: string` to `Project`, then render it in `components/sections/Projects.tsx`.

## Add a brand-new section type (worked example: Certifications)

**1. Database model** in `prisma/schema.prisma`:

```prisma
model Certification {
  id        String   @id @default(cuid())
  name      String
  issuer    String
  year      String
  order     Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

Then run `npm run db:migrate`.

**2. Admin config**: two edits in `src/lib/admin/resources.ts`.

Allow the delegate name:

```ts
delegate: "project" | "experience" | "skillGroup" | "contactLink" | "certification";
```

Add the resource. This one entry gives you the list, drag-reorder, add/edit form, delete and validated API:

```ts
{
  key: "certifications",
  label: "Certifications",
  singular: "certification",
  delegate: "certification",
  titleField: "name",
  subtitleField: "issuer",
  fields: [
    { name: "name", label: "Name", type: "text", max: 120 },
    { name: "issuer", label: "Issuer", type: "text", max: 120 },
    { name: "year", label: "Year", type: "text", max: 10 },
  ],
},
```

**3. Public data**: in `src/lib/types.ts` add the type and a `certifications: Certification[]` key on `Portfolio`.
In `src/lib/portfolio.ts` add `prisma.certification.findMany({ orderBy: { order: "asc" } })` to the `Promise.all`
and map it with `stripMeta`. Add `certifications: []` to `src/content/seed.ts` (or real entries).

**4. Seed** (optional): in `prisma/seed.ts`, copy the pattern used for `project`.

**5. Public component**: create `src/components/sections/Certifications.tsx` (copy `Skills.tsx` as a template), add the
entry to `src/content/sections.ts`, and render it in `src/app/page.tsx`.

That is the whole list: no new API routes, no new admin screens.

## Field types available in resources.ts

| type | Stored as | Editor |
|---|---|---|
| `text` | `String` | single-line input, with a voice-dictation mic button |
| `textarea` | `String` | multi-line input, with a voice-dictation mic button |
| `select` | `String` | dropdown (`options: [...]`) |
| `list` | `String[]` | drag-to-reorder items. `style: "rows"` (default) for prose, one item per line; `style: "chips"` for tag-like values (a flex-wrap pill editor with Enter-to-add) |
| `objects` | `Json` | drag-to-reorder repeatable group of sub-fields (`of: [...]`), each rendered with the same field types recursively |

Voice input, drag-reorder and client-side validation (mirroring the same `schemaFor()` schema used server-side) are
all generic — every field of a given type gets them automatically, with no per-resource wiring. Adding a 9th
resource is still exactly the one-array-edit described above.

## Sections that are one-off rather than lists

Use the `Profile` pattern: a single-row table (fixed `id`), a field list like `PROFILE_FIELDS`, and a GET/PUT route.
