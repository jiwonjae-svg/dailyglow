/**
 * onFollowWrite.ts
 *
 * Firestore trigger: keeps denormalized follower/following counts consistent
 * with documents in `follows/{followId}`. Clients create/delete follow docs;
 * only this trusted function mutates the count fields.
 */

import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onFollowWrite = onDocumentWritten(
  'follows/{followId}',
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const beforeData = before?.data();
    const afterData = after?.data();

    let followerId: string | undefined;
    let followedId: string | undefined;
    let delta = 0;

    if (!before?.exists && after?.exists) {
      followerId = afterData?.followerId;
      followedId = afterData?.followedId;
      delta = 1;
    } else if (before?.exists && !after?.exists) {
      followerId = beforeData?.followerId;
      followedId = beforeData?.followedId;
      delta = -1;
    } else {
      return;
    }

    if (!followerId || !followedId || followerId === followedId) {
      console.warn('[onFollowWrite] Invalid follow data:', event.params.followId);
      return;
    }

    const db = admin.firestore();
    const refs = [
      { ref: db.doc(`users/${followerId}`), data: { followingCount: FieldValue.increment(delta) } },
      { ref: db.doc(`users/${followedId}`), data: { followerCount: FieldValue.increment(delta) } },
      { ref: db.doc(`public_profiles/${followerId}`), data: { followingCount: FieldValue.increment(delta) } },
      { ref: db.doc(`public_profiles/${followedId}`), data: { followerCount: FieldValue.increment(delta) } },
    ];

    await db.runTransaction(async (transaction) => {
      const snapshots = await Promise.all(refs.map(({ ref }) => transaction.get(ref)));
      refs.forEach(({ ref, data }, index) => {
        if (snapshots[index].exists) {
          transaction.update(ref, data);
        }
      });
    });
  },
);
