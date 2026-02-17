import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";


export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Validation failed",
          details: parsed.error.flatten()
        }
      });
    }
    req.body = parsed.data as any;
    next();
  };
}
