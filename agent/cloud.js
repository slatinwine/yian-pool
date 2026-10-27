import { readFileSync } from 'node:fs';
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';

const cfg = JSON.parse(readFileSync(new URL('./cloud.config.json', import.meta.url), 'utf8'));

export const cloud = createWorkBuddyCloud({
  endpoint: cfg.endpoint,
  publishableKey: cfg.publishableKey,
});
export const TABLE = cfg.table;
export const APPLICATION_ID = cfg.applicationId;
