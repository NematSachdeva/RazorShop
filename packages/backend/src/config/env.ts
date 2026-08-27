import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Resolve .env from monorepo root
// This works in both production (ESM) and Jest (CommonJS transpilation)
// Strategy: try multiple common paths in order:
// 1. Assume monorepo root is 4 levels up from src/ or dist/
// 2. Fall back to process.cwd()
// 3. Prioritize explicit .env files

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

interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  FRONTEND_URL: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  GROQ_API_KEY: string;
  JWT_SECRET: string;
}

let cachedEnv: Environment | null = null;

function validateEnv(): Environment {
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
  };
}

export function getEnv(): Environment {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

// For backward compatibility, export lazy getter
export const env = new Proxy<Environment>({} as Environment, {
  get: (_, prop) => {
    const e = getEnv();
    return e[prop as keyof Environment];
  },
});
