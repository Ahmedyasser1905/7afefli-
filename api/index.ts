// api/index.ts
// Root-level Vercel serverless entry point that forwards to services/api/api/index.ts
import 'reflect-metadata';
import handler from '../services/api/api/index';

export default handler;
