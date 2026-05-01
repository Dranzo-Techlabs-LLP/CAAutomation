import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { customAlphabet } from 'nanoid';

const createRequestId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const requestId = req.header('x-request-id') ?? createRequestId();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
