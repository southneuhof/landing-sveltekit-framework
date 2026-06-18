export * from './types/index.js';
export * from './utils/common.js';
export * from './utils/pagination.js';
export * from './utils/response.js';
export * from './utils/trusted-origins.js';
export * from './forms/public-form.js';

import type { LandingFrameworkConfig } from './types/index.js';

export function defineLandingConfig<T extends LandingFrameworkConfig>(config: T): T {
  return config;
}
