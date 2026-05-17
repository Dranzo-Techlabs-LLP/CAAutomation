import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Strip empty-string fields and trim whitespace on JSON request bodies before
 * the global ValidationPipe runs. This lets frontend forms send `field: ""`
 * for optional fields without tripping strict validators (IsEmail, IsUUID,
 * IsNumberString, etc.) — the field simply disappears, the validator skips it.
 *
 * Skips `password*` fields so trailing whitespace is preserved exactly as typed.
 */
@Injectable()
export class BodyTrimMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body = sanitize(req.body) as Record<string, unknown>;
    }
    next();
  }
}

function sanitize(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Preserve password fields verbatim — never trim, never strip empty
      if (/password/i.test(key)) {
        out[key] = value;
        continue;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') continue; // drop empty/whitespace-only strings
        out[key] = trimmed;
      } else if (value === null) {
        // Keep explicit nulls — caller is intentionally clearing the field.
        out[key] = null;
      } else if (typeof value === 'object') {
        out[key] = sanitize(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return input;
}
