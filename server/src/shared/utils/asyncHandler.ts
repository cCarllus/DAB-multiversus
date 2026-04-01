import type { RequestHandler } from 'express';

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response, next)).catch(next);
  };
}
