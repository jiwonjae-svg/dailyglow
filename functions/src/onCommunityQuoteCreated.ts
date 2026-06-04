/**
 * onCommunityQuoteCreated.ts
 *
 * Maintains the per-user submission timestamp buffer used by the client-side
 * rate-limit precheck. Clients cannot mutate `users/{uid}.communitySubmissions`
 * directly.
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

const SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const onCommunityQuoteCreated = onDocumentCreated(
  'community_quotes/{quoteId}',
  async (event) => {
    const quote = event.data?.data();
    const quoteRef = event.data?.ref;
    const submitterId: string | undefined = quote?.submitterId;

    if (!submitterId || !quoteRef) {
      console.warn('[onCommunityQuoteCreated] Missing submitterId:', event.params.quoteId);
      return;
    }

    const db = admin.firestore();
    const userRef = db.doc(`users/${submitterId}`);
    const now = Date.now();
    const cutoff = now - SUBMISSION_WINDOW_MS;

    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const existing = userSnap.exists
        ? ((userSnap.data()?.communitySubmissions as number[] | undefined) ?? [])
        : [];
      const pruned = existing.filter((timestamp) => timestamp > cutoff);

      if (pruned.length >= 3) {
        transaction.update(quoteRef, {
          status: 'rejected',
          moderationReason: 'rateLimit',
          moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      pruned.push(now);
      transaction.set(userRef, { communitySubmissions: pruned }, { merge: true });
    });
  },
);
