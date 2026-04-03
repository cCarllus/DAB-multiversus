import { describe, expect, it } from 'vitest';

import {
  chatHistoryQuerySchema,
  notificationIdParamsSchema,
  notificationsQuerySchema,
  walletTransactionsQuerySchema,
} from '../../app/backend/validators/player-platform.validator';

describe('backend player platform validators', () => {
  it('parses query defaults and notification params', () => {
    expect(walletTransactionsQuerySchema.parse({})).toEqual({
      limit: 50,
    });
    expect(notificationsQuerySchema.parse({})).toEqual({
      limit: 40,
    });
    expect(chatHistoryQuerySchema.parse({})).toEqual({
      limit: 40,
    });
    expect(
      notificationIdParamsSchema.parse({
        notificationId: '6ed6c420-1d64-4f1b-afad-a1310f734111',
      }),
    ).toEqual({
      notificationId: '6ed6c420-1d64-4f1b-afad-a1310f734111',
    });
  });

  it('rejects invalid limits and invalid notification ids', () => {
    expect(() => walletTransactionsQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => notificationsQuerySchema.parse({ limit: 999 })).toThrow();
    expect(() => chatHistoryQuerySchema.parse({ limit: 'nope' })).toThrow();
    expect(() => notificationIdParamsSchema.parse({ notificationId: 'bad-id' })).toThrow();
  });
});
