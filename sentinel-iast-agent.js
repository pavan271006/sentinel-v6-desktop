/**
 * Sentinel SQL X — Standalone Zero-Egress IAST Runtime Agent (ESM Entrypoint)
 * Dual-module support for both ES Modules and CommonJS environments.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const agent = require('./sentinel-iast-agent.cjs');

export default agent;
export const {
  config,
  registerTaint,
  inspectQuery,
  getHistory,
  getBreaches,
  reset,
} = agent;
