import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Resolve .env from monorepo root
// Strategy: try multiple common paths in order
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
  EMAIL_DEMO_MODE: boolean;
  EMAIL_TEST_RECIPIENT: string;
}

let cachedEnv: Environment | null = null;

export function validateEnv(): Environment {
  // Allow missing variables in test environment
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

  const emailDemoModeStr = process.env.EMAIL_DEMO_MODE;
  const EMAIL_DEMO_MODE = emailDemoModeStr === 'false' ? false : true;

  const EMAIL_TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || 't74209185@gmail.com';

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(EMAIL_TEST_RECIPIENT)) {
    throw new Error(`Invalid EMAIL_TEST_RECIPIENT syntax: ${EMAIL_TEST_RECIPIENT}`);
  }

  return {
    NODE_ENV: (process.env.NODE_ENV || 'development') as any,
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
    EMAIL_DEMO_MODE,
    EMAIL_TEST_RECIPIENT,
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

// For backward compatibility, export lazy getter
export const env = new Proxy<Environment>({} as Environment, {
  get: (_, prop) => {
    const e = getEnv();
    return e[prop as keyof Environment];
  },
});
