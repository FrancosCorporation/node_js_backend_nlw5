declare global {
  namespace Express {
    interface Request {
      authAdminId?: string;
    }
  }
}

export {};
