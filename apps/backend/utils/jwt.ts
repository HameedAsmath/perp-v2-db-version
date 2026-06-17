import jwt, { type SignOptions } from "jsonwebtoken";
import type { ZodType } from "zod";
import type { Response } from "express";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export type JwtPayload = {
  userId: string;
};

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret());

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("userId" in payload) ||
    typeof payload.userId !== "string"
  ) {
    throw new Error("invalid token payload");
  }

  return { userId: payload.userId };
}

export function parseBody<T>(
  schema: ZodType<T>,
  body: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      error: "validation failed",
      details: result.error.flatten().fieldErrors,
    });
    return null;
  }

  return result.data;
}
