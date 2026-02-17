import { AuthContext } from "../../middleware/types";

declare global {
  namespace Express {
    interface Request {
      user: AuthContext;
    }
  }
}

export {};
