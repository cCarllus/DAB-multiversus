import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    authContext?: {
      email: string;
      nickname: string;
      sessionId: string;
      userId: string;
    };
  }
}

export {};
