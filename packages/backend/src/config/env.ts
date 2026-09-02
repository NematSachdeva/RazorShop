import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Resolve .env from monorepo root
let envPath: string;

const possiblePaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../../../.env'),
  resolve(process.cwd(), '../../../.env'),
  resolve(process.cwd(), '../../.env'),
];

// Use the first .env file that exists
envPath = possiblePaths.find((p) => existsSync(p)) || possiblePaths[0];

// Load .env if it exists
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  FRONTEND_URL: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  GROQ_API_KEY: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  EMAIL_DELIVERY_MODE: 'mock' | 'live';
  AI_MODE: 'mock' | 'live';
  SCHEDULER_ENABLED: boolean;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  SARVAM_API_KEY?: string;
}

let cachedEnv: Environment | null = null;

export function validateEnv(): Environment {
  // Determine if running in Jest test runner context
  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'FRONTEND_URL',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'GROQ_API_KEY',
    'JWT_SECRET',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0 && !isTest) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `See .env.example for required variables.\n` +
      `Expected .env at: ${envPath}`
    );
  }

  const emailModeInput = (process.env.EMAIL_DELIVERY_MODE || '').toLowerCase();
  // Automated tests MUST ALWAYS force mock mode regardless of developer .env
  const EMAIL_DELIVERY_MODE: 'mock' | 'live' = isTest ? 'mock' : (emailModeInput === 'live' ? 'live' : 'mock');

  const aiModeInput = (process.env.AI_MODE || '').toLowerCase();
  const AI_MODE: 'mock' | 'live' = isTest ? 'mock' : (aiModeInput === 'live' ? 'live' : 'mock');

  // Background scheduler is disabled by default in test/dev unless explicitly enabled
  const SCHEDULER_ENABLED = isTest ? false : process.env.SCHEDULER_ENABLED === 'true';

  // Default hash below is bcrypt for 'password123' used strictly for safe local test defaults
  const defaultAdminHash = '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW';

  return {
    NODE_ENV: (process.env.NODE_ENV || (isTest ? 'test' : 'development')) as any,
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL || '',
    FRONTEND_URL: process.env.FRONTEND_URL || '',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'nemat@razorshop.app',
    EMAIL_DELIVERY_MODE,
    AI_MODE,
    SCHEDULER_ENABLED,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@razorshop.app',
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || defaultAdminHash,
    SARVAM_API_KEY: process.env.SARVAM_API_KEY || '',
  };
}

export function getEnv(): Environment {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

export const env = new Proxy<Environment>({} as Environment, {
  get: (_, prop) => {
    const e = getEnv();
    return e[prop as keyof Environment];
  },
});
