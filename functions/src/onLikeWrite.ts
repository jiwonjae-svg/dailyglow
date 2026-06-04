/**
 * onLikeWrite.ts
 *
 * Firestore trigger: whenever a document in `community_likes/{likeId}` is
 * created or deleted, atomically increment/decrement the `likeCount` field
 * on the corresponding `community_quotes/{quoteId}` document.
 */

import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

async function updateQuoteLikeCount(
  quoteRef: admin.firestore.DocumentReference,
  delta: number,
): Promise<void> {
  try {
    await quoteRef.update({ likeCount: FieldValue.increment(delta) });
  } catch (err: any) {
    if (err?.code === 5 || err?.code === 'not-found') {
      console.warn('[onLikeWrite] Quote missing; counter update skipped:', quoteRef.path);
      return;
    }
    throw err;
  }
}

export const onLikeWrite = onDocumentWritten(
  'community_likes/{likeId}',
  async (event) => {
    const likeId: string = event.params.likeId;

    const before = event.data?.before;
    const after = event.data?.after;
    const beforeData = before?.data();
    const afterData = after?.data();
    const quoteId: string | undefined = afterData?.quoteId ?? beforeData?.quoteId;

    if (!quoteId) {
      console.warn('[onLikeWrite] Missing quoteId for like document:', likeId);
      return;
    }

    const quoteRef = admin.firestore().doc(`community_quotes/${quoteId}`);

    if (!before?.exists && after?.exists) {
      await updateQuoteLikeCount(quoteRef, 1);
    } else if (before?.exists && !after?.exists) {
      await updateQuoteLikeCount(quoteRef, -1);
    }
  },
);
