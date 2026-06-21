// services/api/set-env.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

// Parse local .env
envContent.split(/\r?\n/).forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    // Strip surrounding quotes if any
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    envVars[key] = val;
  }
});

// Override/Add custom values
envVars['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk5OTU4NiwiZXhwIjoyMDk1NTc1NTg2fQ.TZN0y4RHtZqVQ8cqzPV6VM5M0knhIgGZY6ZZmjN7mAw';
envVars['ALLOWED_ORIGINS'] = 'https://admin-one-jade-82.vercel.app,https://7afefli-api.vercel.app,https://7afefli-hulivyed7-ahmeds-projects-7b24d0cd.vercel.app,exp://,http://192.168.1.11:3000,http://localhost:3000,http://localhost:8081';
envVars['APP_URL'] = 'https://api-coral-sigma-49.vercel.app';
envVars['CHARGILY_WEBHOOK_URL'] = 'https://api-coral-sigma-49.vercel.app/api/v1/payments/webhook';
envVars['CRON_SECRET'] = 'cron-secret-super-key-998877';

const targets = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'REDIS_URL',
  'CHARGILY_SECRET_KEY',
  'SENTRY_DSN',
  'APP_URL',
  'CHARGILY_WEBHOOK_URL',
  'CRON_SECRET',
  'NODE_ENV'
];

targets.forEach((key) => {
  const val = envVars[key];
  if (!val) {
    console.log(`Skipping ${key} (no value found)`);
    return;
  }

  console.log(`Setting ${key}...`);

  // 1. Remove if exists (to avoid duplicate/overwrite prompt blocks)
  spawnSync('npx', ['vercel', 'env', 'rm', key, 'production', '-y'], {
    stdio: 'ignore',
    shell: true
  });

  // 2. Add environment variable cleanly via stdin
  const child = spawnSync('npx', ['vercel', 'env', 'add', key, 'production'], {
    input: val,
    encoding: 'utf8',
    shell: true
  });

  if (child.status !== 0) {
    console.error(`Failed to set ${key}:`, child.stderr || child.stdout);
  } else {
    console.log(`Successfully set ${key}`);
  }
});

console.log('All environment variables set successfully!');
