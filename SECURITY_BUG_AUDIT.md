# Security And Bug Audit

Date: 2026-06-04

Scope: likely security vulnerabilities and correctness bugs found in the current DailyGlow worktree, with fixes applied where practical without adding major features.

## Fixed Findings

### 1. User document privilege escalation

Risk: `users/{uid}` previously allowed a signed-in user to update their entire own document. A modified client could set fields such as `isAdmin`, `isPremium`, `isDisabled`, social counters, or submission counters.

Fix:
- Rewrote `firestore.rules` with explicit allowlists for user document creation/update.
- Blocked client mutation of admin, disabled, premium, social counter, and submission counter fields.
- Limited user document reads to the owner or an admin.
- Disabled the client Firestore premium mirror; RevenueCat is treated as the authoritative premium source.

### 2. Public profile data mixed with private user data

Risk: social/profile features read `users/{uid}`, which also stores account and sync fields such as email, settings, streak, premium state, badges, and FCM token.

Fix:
- Added `public_profiles/{uid}` as the public read model.
- Updated profile sync, username search, public profile fetches, and follow-list profile fetches to use `public_profiles`.
- Kept private user data under owner/admin-only `users/{uid}` rules.
- Kept public profile follower/following counters server-owned so client profile sync cannot overwrite function-maintained counts.

### 3. Community quote self-approval

Risk: clients could create community quotes with `status: 'approved'`, bypassing moderation intent.

Fix:
- Changed `submitCommunityQuote` to create `pending` submissions.
- Updated Firestore rules so client-created community quotes must be `pending`.
- Kept approval/status changes server/admin-owned.

### 4. Client-owned like, report, follow, and submission counters

Risk: clients could directly mutate denormalized counters or trigger rejected counter writes, causing tampering or inconsistent UI state.

Fix:
- Removed client writes for `likeCount`, `reportCount`, and follow counts.
- Added Cloud Functions:
  - `onLikeWrite`
  - `onReportWrite`
  - `onFollowWrite`
  - `onCommunityQuoteCreated`
- Updated Firestore rules so counter fields are not client-mutable.
- `onCommunityQuoteCreated` now rejects over-limit burst submissions server-side instead of relying only on the client precheck.

### 5. Follow notification spam surface

Risk: any authenticated client could create arbitrary notification documents under another user's notification subcollection.

Fix:
- Restricted notification creates to `follow_{request.auth.uid}` documents.
- Required matching `fromUid`, `type: 'follow'`, `read: false`, and bounded optional sender fields.

### 6. Like trigger quote ID parsing bug

Risk: `onLikeWrite` parsed `quoteId` from the first underscore in `{userId}_{quoteId}`. If IDs contained underscores, the wrong quote could be updated.

Fix:
- `onLikeWrite` now reads `quoteId` from the like document data instead of parsing the document ID.

### 7. Follow count target integrity bug

Risk: clients could create follows for arbitrary nonexistent target IDs; a counter trigger could then create count-only user documents.

Fix:
- Firestore rules now require `followedId` to reference an existing user document and reject self-follow.

### 8. Auto-approval timestamp comparison bug

Risk: `autoApprove` compared Firestore `createdAt` timestamps to a JavaScript number, which could prevent scheduled approval queries from matching correctly.

Fix:
- `autoApprove` now uses `admin.firestore.Timestamp.fromMillis(...)` for the cutoff query.

### 9. Username search empty-query bug

Risk: an empty username query could compute an invalid range end from `charCodeAt(-1)`.

Fix:
- `searchUsersByUsername` now trims/lowercases input and returns an empty list for blank queries.
- `saveUserProfile` now reserves `usernames/{username}` transactionally and returns `taken` if another user already owns the handle.

### 10. Forged timestamp and arbitrary payload writes

Risk: several client-created documents accepted arbitrary `createdAt`, `timestamp`, or extra payload fields. In particular, community quote auto-approval depends on `createdAt`, so a forged old timestamp could shorten moderation time.

Fix:
- Required server timestamp resolution (`request.time`) for quote, like, report, follow, notification, activity, rating, and top-level report writes.
- Added document-shape allowlists for activity, report, and rating create/update rules.
- Added username format validation to Firestore rules, not only client service code.

### 11. Counter triggers retrying deleted quote targets

Risk: like/report counter triggers used direct updates against `communityQuotes/{quoteId}`. If the quote was deleted or rejected before the trigger ran, the function could fail and retry instead of treating the missing target as a terminal condition.

Fix:
- Updated `onLikeWrite` and `onReportWrite` to ignore missing quote targets after logging the condition.
- Kept other Firestore write failures retryable so transient backend errors are still surfaced.

### 12. Follow counter trigger could recreate profile shells

Risk: the follow counter trigger used merge writes for user and public profile counters. If a user/profile document was deleted, a later follow delete/create event could recreate a count-only shell document.

Fix:
- Changed `onFollowWrite` to run in a transaction.
- The trigger now reads each target document first and updates counters only when that document already exists.

### 13. Loose compound IDs allowed duplicate social records

Risk: like, report, follow, and rating rules only required document IDs to start with the caller's UID. A modified client could create multiple documents for the same target under different IDs and inflate denormalized counters.

Fix:
- Required exact document IDs in the form `{uid}_{targetId}` for likes, reports, follows, and ratings.
- Added quote-existence checks for like/report creation and followed-user existence checks for follow creation.
- Rejected target IDs containing `/` so client-supplied IDs cannot escape the intended document path.

### 14. Post-moderation community quote edits

Risk: a submitter could edit their own community quote after it had already been approved, changing moderated public content without a new review.

Fix:
- Restricted submitter edits to `pending` community quotes.
- Kept approval/status changes admin-owned.

### 15. Username reservation squatting

Risk: any signed-in client could reserve arbitrary `usernames/{username}` documents for itself, even when the profile username did not match that reservation.

Fix:
- Added username document ID validation in Firestore rules.
- Required username reservation creates/deletes to match the caller's post-transaction `users/{uid}.username` state.

## Verification

Passed:

```bash
npm run lint
npm test
npm run build
.\node_modules\.bin\tsc.cmd -p functions\tsconfig.json
```

Note: the npm scripts require filesystem access to the global npm shim under `AppData\Roaming` in this sandboxed workspace. They passed when rerun with that access.

Not yet verified:

- Firestore rules were not emulator-tested because `firebase-tools` / `@firebase/rules-unit-testing` is not installed locally.
- Cloud Functions behavior was type-checked but not exercised against a Firebase emulator.

## Residual Risk

- Server-side submission rate limiting still happens after document creation because Firestore rules cannot count recent submissions. Over-limit burst submissions are now rejected by `onCommunityQuoteCreated`, but a stricter release-ready design would move quote submission behind a callable/HTTPS Cloud Function to prevent the write before it exists.
- Existing production Firestore data, if any, may need a one-time backfill from `users/{uid}` into `public_profiles/{uid}` before fully relying on the new public profile read path.
