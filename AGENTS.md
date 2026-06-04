# AGENTS.md

## Repository Goal

DailyGlow is part of a Japan-focused software engineering portfolio. Treat every change as a hiring signal: reliability, clear documentation, focused tests, and technical explanation matter more than adding features.

## Working Rules

- Preserve existing app behavior unless the user explicitly asks for a behavior change.
- Do not add unnecessary features, screens, integrations, metrics, badges, or marketing claims.
- Do not invent users, production adoption, certifications, revenue, store performance, or operational scale.
- Keep changes small, reviewable, and aligned with the existing Expo/React Native architecture.
- Prefer tests for isolated core logic, data transformations, state transitions, and validation rules.
- Update README content when changes affect setup, architecture, technical tradeoffs, tests, or portfolio explanation.
- Avoid touching generated binaries, signing files, local secrets, `.env`, native build outputs, or unrelated dirty files.

## Project Map

- `app/`: Expo Router screens and tab navigation.
- `components/`: Reusable React Native UI, including quote cards, activity sheets, onboarding, modals, and profile/community UI.
- `stores/`: Zustand state for quotes, user preferences, grass/streak data, community state, and autoplay.
- `services/`: Firebase, Firestore, quote loading, community operations, notifications, ads, purchases, sharing, widgets, and logging.
- `hooks/`: Native capability wrappers such as TTS, speech recognition, OCR, and theme colors.
- `data/`: Bundled quote/category/praise datasets used by the offline-first quote flow.
- `functions/`: Firebase Cloud Functions TypeScript project.
- `internal/scripts/`: Maintenance scripts for quote data, Firebase upload, secret checks, and local Android build helpers.

## Quality Gate

Before considering work complete, run the available checks from the repository root:

```bash
npm run lint
npm test
npm run build
```

If a check fails because of a pre-existing baseline issue, report the exact command and error summary. Do not hide failures.

## Documentation Standards

README updates should favor technical clarity over promotion. Keep these sections present and current:

1. Product summary
2. Key features
3. Tech stack
4. Architecture or data flow
5. Technical challenges
6. What I improved
7. How to run locally
8. Tests
9. Japanese summary

## Implementation Guidance

- Use existing service/store boundaries instead of introducing new global state patterns.
- Keep native-module integrations guarded so Expo Go, web, and unsupported builds fail gracefully.
- Keep offline behavior intact: bundled quote data should remain usable without Firebase configuration.
- Treat Firebase and purchase integrations as optional at local-development time unless a task specifically targets them.
- Validate community/user input at the service boundary and keep Firestore rules/functions in sync when data contracts change.

## Commit/Push Automation

- After implementing user-requested changes in this repository and passing verification, automatically commit and push unless the user explicitly asks not to.
- Use `scripts/codex-commit-push.ps1` for automated commits. Provide an explicit commit message and explicit file list whenever possible.
- Do not stage unrelated files. Never stage `.env`, `.env*.local`, `.vercel`, `.next`, `node_modules`, `repomix-output.xml`, build outputs, or ignored/generated output.
- Prefer a `codex/` branch for new work. If the user is already working on `main` and explicitly wants direct deployment or push, use `-AllowMain`.
- Use `-AllowAssets` only when the requested change intentionally adds or updates binary assets such as screenshots.
- If lint, test, or build checks fail, fix the failure before committing. If the failure is unrelated and cannot be fixed safely, report it and do not hide it.
- GitHub CLI is available as `gh`; if `gh auth status` reports logged out, run `gh auth login` before GitHub API, issue, PR, or release operations.
