/**
 * index.ts — Cloud Functions entry point for DailyGlow.
 *
 * Initialise the Admin SDK once here, then re-export all functions.
 */

import * as admin from 'firebase-admin';

// Initialise once (idempotent in the emulator and production)
admin.initializeApp();

export { onLikeWrite } from './onLikeWrite';
export { onFollowWrite } from './onFollowWrite';
export { onReportWrite } from './onReportWrite';
export { onCommunityQuoteCreated } from './onCommunityQuoteCreated';
export { autoApprove }  from './autoApprove';
export { notifyStatus } from './notifyStatus';
export { schedulePersonalizedPush } from './smartNotifications';
