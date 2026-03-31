declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        email: string;
        username: string | null;
      };
    }
  }
}

export {};
