# DailyGlow

DailyGlow is an Expo/React Native mobile app for building a daily quote habit. It combines a curated quote feed with speak-along, type-along, and write-along practice modes, then records progress through local state with optional Firebase sync.

This repository is maintained as a Japan-focused software engineering portfolio project. The documentation emphasizes product readiness, reliability, multilingual support, Firebase security, and testable core logic without claiming production usage, user counts, certifications, revenue, or store performance.

## Product Explanation (English / Japanese)

### English

DailyGlow helps users turn short positive quotes into a repeatable daily practice. The core experience is a mobile quote feed backed by bundled offline data, with optional cloud-backed account sync and community features when Firebase is configured. Users can read, listen, speak, type, or handwrite quotes, while the app tracks activity through streak and calendar-style progress views.

From an engineering perspective, the project demonstrates a practical mobile product structure: offline-first data loading, native capability guards, local persistence, multilingual UI, Firebase integration, Firestore rules, and unit-tested text matching and quote selection logic.

### 日本語

DailyGlow は、短い前向きな名言を毎日の習慣に変えるためのモバイルアプリです。オフラインで使える同梱データを中心に、Firebase を設定した場合はアカウント同期やコミュニティ機能も利用できます。ユーザーは名言を読むだけでなく、音読、タイピング、手書き練習を通して継続的に取り組めます。

エンジニアリング面では、オフラインファーストのデータ設計、ネイティブ機能の安全な呼び出し、ローカル永続化、多言語 UI、Firebase 連携、Firestore Security Rules、テスト可能な名言選択ロジックを示すポートフォリオとして整理しています。

## Key Features

- Quote feed with category-aware selection, recent-quote exclusion, cached batches, and bundled fallback data.
- Speak-along practice using text-to-speech, speech recognition, and similarity scoring.
- Type-along practice with character-level feedback.
- Write-along practice using camera capture, OCR when the native module is available, and best-match text comparison.
- Progress tracking with daily activity, streak data, bookmarks, badges, and a grass-style calendar view.
- Multilingual UI and quote translations for Korean, English, Spanish, Japanese, and Chinese.
- Optional Firebase Auth, Firestore sync, community quote submission, likes, reports, and profile data.
- Optional notifications, sharing, home-screen widget data, ads, and premium/purchase code paths.

## Tech Stack

| Area | Technology |
| --- | --- |
| Mobile framework | Expo SDK 54, React Native 0.81 |
| Language | TypeScript |
| Routing | Expo Router |
| State | Zustand |
| Local persistence | AsyncStorage |
| Cloud backend | Firebase Auth, Firestore, Firebase Cloud Functions |
| Native capabilities | Expo Camera, Expo Speech, Expo Notifications, speech recognition, ML Kit OCR |
| Internationalization | i18next, react-i18next, expo-localization |
| Monetization paths | Google Mobile Ads, RevenueCat packages |
| Verification | TypeScript build, Node test runner, custom secret scan |

## Architecture And Data Flow

DailyGlow uses a layered client architecture:

1. `app/` defines Expo Router screens and tab navigation.
2. `components/` renders quote cards, activity sheets, modals, settings, profile, and community UI.
3. `stores/` keeps session and persisted state in Zustand stores.
4. `services/` handles quote loading, Firebase/Auth/Firestore access, community operations, notifications, sharing, ads, purchases, widgets, and logging.
5. `data/` provides bundled quote, category, and praise datasets for offline-first local behavior.
6. `utils/` contains testable pure logic such as text similarity and quote selection.
7. `functions/` contains the Firebase Cloud Functions project for backend automation.

Quote loading flows through `services/quoteService.ts`: bundled quotes are always available, Firestore quote chunks are fetched when Firebase is configured, server quotes are cached in AsyncStorage, and recent quote IDs are excluded to reduce immediate repetition. UI components consume the resulting quote batches through `stores/useQuoteStore.ts`.

User data flows through `stores/useUserStore.ts`: local settings and progress persist to AsyncStorage, while logged-in accounts can sync selected profile, badge, bookmark, streak, and activity data through Firestore service helpers.

Native integrations are guarded at runtime so unsupported environments can fail gracefully instead of crashing the app.

## Quote Data Pipeline

DailyGlow keeps the quote pipeline small enough to reason about and test:

1. Bundled offline quotes: `data/quotesClient.json` is loaded through `data/quotes.ts`, so the quote feed can work without network access or Firebase credentials.
2. Optional server quotes: `services/firebaseConfig.ts` can fetch Firestore quote chunks from `quotes_catalog`; `services/quoteService.ts` stores them in AsyncStorage with a 7-day cache window and falls back to stale cache or bundled quotes if fetching fails.
3. Category weighting: each quote can carry category weights. `utils/quoteSelection.ts` scores the selected user categories and chooses the highest-scoring quote from each candidate window.
4. Recency buffer: recently selected quote IDs are stored in AsyncStorage under `@dailyglow_recent_quote_ids`. The selector excludes those IDs while enough candidates remain, then resets the buffer when the available pool becomes too small.
5. Multilingual support: quote text uses the active i18n language when a translation exists and falls back to the original quote text otherwise. UI strings are organized under `i18n/locales/`.
6. UI consumption: selected items are mapped into the app-level `Quote` shape with author, source, top category, timestamp, and gradient metadata before entering `useQuoteStore`.

The pure selection rules are covered by unit tests in `tests/quoteSelection.test.mjs`, while storage and Firebase fallback remain inside `quoteService`.

## Firebase Security Rules

Firestore rules are defined in `firestore.rules`. The current model protects data with these boundaries:

- `quotes_catalog` is public read-only; clients cannot write quote catalog documents.
- `users/{userId}` is readable only by the owner or an admin. Owner writes are allowlisted and cannot mutate `isAdmin`, `isDisabled`, premium status, social counters, or submission counters.
- `public_profiles/{userId}` is public read for social/profile UI. Owners can update display fields, while follower/following counters are maintained by Cloud Functions.
- `users/{userId}/quoteHistory` and `users/{userId}/grassHistory` are owner-only read/write subcollections for private quote and activity history.
- `usernames/{username}` is public read for availability checks, but creation/deletion must point to the authenticated user's UID and updates are blocked.
- `community_quotes` is public read. Authenticated users can create `pending` submissions tied to their UID, authors can edit limited fields, admins can update status/disable flags, and authors can delete their own posts.
- `community_likes`, `community_reports`, `follows`, and `quoteRatings` bind document IDs or fields to `request.auth.uid` so users can only create or remove their own interactions.
- Like, report, follow, and submission counters are server-owned through Firebase Cloud Functions, not arbitrary client updates.
- `activities` and top-level `reports` are create-only for authenticated users and are not readable or mutable by clients.

## Screenshots Placeholders

Screenshots should be added before portfolio publication or store-review preparation. Suggested placeholders:

| Locale | Home feed | Practice flow | Settings/profile |
| --- | --- | --- | --- |
| Korean | `docs/screenshots/ko-home.png` | `docs/screenshots/ko-practice.png` | `docs/screenshots/ko-settings.png` |
| English | `docs/screenshots/en-home.png` | `docs/screenshots/en-practice.png` | `docs/screenshots/en-settings.png` |
| Japanese | `docs/screenshots/ja-home.png` | `docs/screenshots/ja-practice.png` | `docs/screenshots/ja-settings.png` |

## Technical Challenges

- Keeping the app usable without Firebase configuration while still supporting cloud sync when credentials exist.
- Preventing native-module crashes in Expo Go or unsupported builds by checking availability before using OCR, speech recognition, ads, notifications, and monitoring.
- Maintaining consistent local state when switching between guest mode, login, logout, and cloud restore.
- Matching speech/OCR text against quotes across punctuation, whitespace, case, and line-break differences.
- Keeping community submission logic bounded with input sanitization, ownership checks, reports, and Firestore-backed counters.
- Documenting mobile setup clearly without implying that optional native services are required for every local workflow.

## Release Readiness Checklist

- [ ] Android internal testing: build a signed internal test artifact, install on physical devices, verify sign-in, quote feed, practice flows, notifications, ads disabled/enabled states, and offline behavior.
- [ ] iOS/TestFlight readiness: confirm bundle identifier, Apple signing, required privacy strings, Google/Firebase config, speech/camera behavior, and TestFlight build upload.
- [ ] Privacy policy: keep `privacy-policy.md` current with auth, local storage, Firebase, ads, purchases, notifications, speech/OCR, and community content handling.
- [ ] App permissions: review camera, microphone, speech recognition, notifications, internet, and platform-specific permission copy before store submission.
- [ ] Crash/error logging plan: confirm Sentry or another crash reporting path is configured for production builds, with no sensitive quote/user content logged.
- [ ] Firebase rules review: deploy and test `firestore.rules` with emulator or Firebase rules tests before public release.
- [ ] Multilingual QA: verify KO/EN/JA core screens for layout overflow, truncation, and locale-specific copy quality.
- [ ] Screenshot set: capture KO/EN/JA home, practice, and settings/profile screens listed above.

## What I Improved

- Replaced the previous corrupted, marketing-heavy README with a portfolio-focused technical README.
- Added `AGENTS.md` so future agent changes follow the same reliability-first constraints.
- Added repeatable `lint`, `test`, and `build` scripts to `package.json`.
- Extracted quote selection into `utils/quoteSelection.ts` so category weighting and recency behavior can be unit tested.
- Added Node test coverage for `utils/similarity.ts`, `utils/quoteSelection.ts`, and `stores/useQuoteStore.ts`.
- Fixed small TypeScript build issues around Firestore user count fields and a missing Zustand action implementation.

## How To Run Locally

Prerequisites:

- Node.js 20 or newer
- npm
- Expo-compatible Android or iOS environment for native builds

Install dependencies:

```bash
npm install
```

Create a local environment file if you need Firebase, Google sign-in, RevenueCat, or other configured services:

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Start the Expo development server:

```bash
npm start
```

Run a native development build when testing device-only capabilities:

```bash
npm run android
npm run ios
```

Some features, including OCR, speech recognition, push notifications, ads, purchases, and native widgets, require a development build and valid native configuration. The bundled quote flow should remain usable without cloud credentials.

## Tests

Run the repository checks from the root:

```bash
npm run lint
npm test
npm run build
```

Current automated coverage includes:

- `tests/similarity.test.mjs`: text normalization, speech/OCR similarity, and typing match status.
- `tests/quoteSelection.test.mjs`: category weighting, recency-aware pool selection, and recency buffer updates.
- `tests/quoteStore.test.mjs`: practical Zustand quote store state transitions.

`npm run lint` runs the repository secret scan, and `npm run build` runs TypeScript with `--noEmit`.

## Japanese Summary

DailyGlow は、毎日の名言を「読む」だけで終わらせず、音読、タイピング、手書き練習に変えるモバイルアプリです。日本向けポートフォリオとして、機能の多さよりも、オフライン対応、Firebase セキュリティ、多言語 UI、テスト可能なロジック、リリース準備の説明を重視しています。

## License

MIT. See [LICENSE](LICENSE).
