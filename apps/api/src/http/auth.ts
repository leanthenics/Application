import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';
import { apiError } from './errors.js';

/**
 * Authentication middleware. Verifies a Supabase user access token (asymmetric
 * ES256) locally against the project's public JWKS — no round-trip to Supabase
 * per request; the key is fetched once and cached, refetched only on rotation.
 *
 * On success `req.userId` is the token subject (the Supabase user id). Any missing
 * or invalid token → 401 with a generic message (the real reason is logged
 * server-side only, never leaked to the client).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Lazily built so a missing SUPABASE_URL fails on first request (with a clear log)
// rather than crashing the whole process at import time.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!config.supabase.jwksUrl) {
    throw new Error('SUPABASE_URL is not set — cannot verify auth tokens');
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.supabase.jwksUrl));
  }
  return jwks;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json(apiError('unauthorized', 'Missing or malformed Authorization header'));
    return;
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: config.supabase.issuer,
      audience: 'authenticated',
    });
    if (!payload.sub) {
      res.status(401).json(apiError('unauthorized', 'Token missing subject'));
      return;
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    console.warn('[auth] token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json(apiError('unauthorized', 'Invalid or expired token'));
  }
}
