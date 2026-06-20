import type { Request, Response } from "express";
import type { ZodType } from "zod";
import { prisma } from "database";
import { signToken } from "../utils/jwt";
import { signinSchema, signupSchema } from "../validators/auth.schema";
import { loopback } from "../redis/loopback";

function omitPassword<T extends { password: string }>(
  user: T,
): Omit<T, "password"> {
  const { password, ...rest } = user;
  return rest;
}

function parseBody<T>(
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

export async function signup(req: Request, res: Response) {
  const parsed = parseBody(signupSchema, req.body, res);
  if (!parsed) return;

  const { username, email, password } = parsed;

  try {
    const hashedPassword = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    const user = await prisma.user.create({
      data: { username, email, password: hashedPassword },
    });

    const INITIAL_BALANCE = 10000;
    await loopback({
      messageType: "create_user",
      userId: user.id,
      initialBalance: String(INITIAL_BALANCE),
    });

    const token = signToken(user.id);

    res.status(201).json({
      token,
      user: omitPassword(user),
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "username or email already exists",
      });
      return;
    }

    console.error("signup failed", error);
    res.status(500).json({
      error: "failed to create account",
    });
  }
}

export async function signin(req: Request, res: Response) {
  const parsed = parseBody(signinSchema, req.body, res);
  if (!parsed) return;

  const { email, password } = parsed;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({
        error: "invalid email or password",
      });
      return;
    }

    const valid = await Bun.password.verify(password, user.password);

    if (!valid) {
      res.status(401).json({
        error: "invalid email or password",
      });
      return;
    }

    const token = signToken(user.id);
    // const INITIAL_BALANCE = 10000;
    // await loopback({
    //   messageType: "create_user",
    //   userId: user.id,
    //   initialBalance: String(INITIAL_BALANCE),
    // });

    res.json({
      token,
      user: omitPassword(user),
    });
  } catch (error) {
    console.error("signin failed", error);
    res.status(500).json({
      error: "failed to sign in",
    });
  }
}
