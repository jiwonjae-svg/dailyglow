/**
 * onReportWrite.ts
 *
 * Firestore trigger: whenever a community report is created, increment the
 * reported quote's denormalized `reportCount`. Clients write report records;
 * only this trusted function mutates the quote counter.
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

async function updateQuoteReportCount(
  quoteRef: admin.firestore.DocumentReference,
): Promise<void> {
  try {
    await quoteRef.update({ reportCount: FieldValue.increment(1) });
  } catch (err: any) {
    if (err?.code === 5 || err?.code === 'not-found') {
      console.warn('[onReportWrite] Quote missing; counter update skipped:', quoteRef.path);
      return;
    }
    throw err;
  }
}

export const onReportWrite = onDocumentCreated(
  'community_reports/{reportId}',
  async (event) => {
    const report = event.data?.data();
    const quoteId: string | undefined = report?.quoteId;

    if (!quoteId) {
      console.warn('[onReportWrite] Missing quoteId for report:', event.params.reportId);
      return;
    }

    await updateQuoteReportCount(admin.firestore().doc(`community_quotes/${quoteId}`));
  },
);
