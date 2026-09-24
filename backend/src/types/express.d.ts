declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: string;
        walletAddress: string;
        role: 'customer' | 'organizer' | 'staff' | 'admin';
      };
    }
  }
}

export {};
