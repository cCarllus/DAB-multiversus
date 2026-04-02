import type { Request, Response } from 'express';
import { vi } from 'vitest';

export function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    auth: undefined,
    body: {},
    file: undefined,
    header: () => undefined,
    headers: {},
    ...overrides,
  } as Request;
}

export function createResponse(): Response & {
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const response = {
    json: vi.fn(),
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.send.mockReturnValue(response);

  return response;
}
