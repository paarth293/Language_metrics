# Repository structure and ownership

Language Metrics uses npm workspaces. Deployable applications live in `apps/`;
reusable implementation lives in `packages/`. Workspace dependencies must be
declared in the importing workspace's `package.json` and imported through their
public package exports, never through another workspace's source paths.

## Applications

| Application | Responsibility |
| --- | --- |
| `teacher-web` | Public website, account registration, teacher portal, and existing `/student/*` compatibility routes |
| `student-web` | Dedicated student portal and mobile API |
| `admin-panel` | Administration, support, and live operations |
| `student-mobile` | Native student experience; uses web signup and the student API |

The student routes in teacher-web remain operational. They are not dead code:
removing them requires a separate migration of links, authentication redirects,
and deployment configuration. New student portal functionality belongs in
student-web; common behavior belongs in a shared package.

## Shared packages

| Package | Responsibility | Runtime |
| --- | --- | --- |
| `api-contracts` | Web/mobile request and response contracts | Shared |
| `auth` | Authentication and session infrastructure | Server |
| `database` | Prisma client, schema, migrations, and coin ledger | Server |
| `currency` | Currency helpers | Shared |
| `languages` | Language and proficiency reference data | Shared |
| `livekit` | Video configuration, metering, and SDK adapters | Explicit client/server exports |
| `live-classes` | Class access, booking, settlement, and webhook services | Server |
| `classroom` | Shared web classroom, prejoin devices, and join-window helpers | Web client |
| `ui` | Shared web primitives and password input | Web; `cn` is a pure utility |

Native UI stays in student-mobile. Do not import web components into the native
app. Likewise, do not import server packages into client components.

`classroom/src/LiveClassroom.tsx` coordinates joining and connection state.
Its `components/` directory owns preview, classroom shell, stage, chat, controls,
and error/loading views. `hooks/` owns device lifecycles, and `types.ts` holds
internal component contracts.

Existing app-local UI, classroom, language, and join-window modules are small
compatibility re-exports. They retain existing imports without duplicating
implementation. New consumers can import the package directly. Changes to shared
behavior must be made in the package, not in these adapters.

## Inside a web application

- `src/app/`: routes, route layouts, and HTTP adapters.
- `src/features/<feature>/`: feature-specific components, services, and validation.
- `src/components/`: application shell and app-specific reusable views.
- `src/lib/`: integration adapters and app-specific infrastructure.
- `src/hooks/`: reusable hooks that are not owned by one feature.

Prefer extracting meaningful responsibilities from large pages when changing
them. Do not create a new shared package for a single screen, or move route files
solely to make the directory tree look uniform. Thin HTTP adapters can exist in
multiple apps when deployment or same-origin authentication requires them; the
business rules they call should have one implementation.

## Tooling and checks

`tooling/typescript/next.json` holds common web compiler defaults. App configs
retain their own aliases, target, and generated Next.js types. Shared-package
lint rules live in `tooling/eslint/shared.mjs`.

Both web portals explicitly include `packages/ui/src` and
`packages/classroom/src` in Tailwind's source scan. This is required to generate
styles for components that no longer live inside the app.

Run from the repository root:

```sh
npm ci
npm run check:structure
npm run typecheck
npm test
npm run lint
npm run build
```

With teacher-web and student-web running, `npm run test:smoke` verifies password
visibility, keyboard operation, and input/button layout in the configured
Playwright browsers. Set `TEACHER_WEB_URL` and `STUDENT_WEB_URL` when using ports
other than 3000 and 3002. It does not submit login credentials.

`check:structure` checks workspace imports, declared internal dependencies,
package export targets, and shared Tailwind sources. `typecheck` and `test`
run workspace scripts. Integration tests in `tests/e2e/` require running portals;
live video, database, payment, and email verification additionally require their
configured services. Local unit checks are not substitutes for those checks.

Lint runs with `--max-warnings 0` in the web apps and shared UI packages. Correct
the cause of a new diagnostic before merging; document narrowly scoped security
false positives only after verifying the input validation or index bounds.
Database runtime enum exports in `packages/database/src/index.ts` must stay
aligned with the Prisma schema when adding enums.

Build output, test reports, dependencies, and local environment files are ignored
by Git. They may appear in the local directory tree but are not source folders.
