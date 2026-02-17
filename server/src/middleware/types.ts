import { Request } from "express";

export type AuthContext = {
  id: number;
  roleNames: string[];
  permissions: string[];
  teacherId?: number | null;
};

export type AuthedRequest = Request & { user: AuthContext };
