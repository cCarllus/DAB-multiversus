declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        email: string;
        nickname: string;
      };
    }
  }
}

export {};
