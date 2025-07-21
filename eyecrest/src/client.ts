/**
 * Type-safe Spiceflow client for the Eyecrest API
 */

import { createSpiceflowClient } from 'spiceflow/client';
import type { app } from './worker.js';

// Export the app type for external use
export type EyecrestApp = typeof app;

// Create and export a client factory function
export function createEyecrestClient(baseURL: string) {
  return createSpiceflowClient<EyecrestApp>(baseURL);
}