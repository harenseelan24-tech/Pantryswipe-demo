import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  verifyPassword,
} from "../lib/users-store";

const router = Router();

const JWT_SECRET =
  process.env["JWT_SECRET"] ?? "pantryswipe-dev-secret-change-in-production";
const JWT_EXPIRY = "90d";

const RegisterSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  email: z.string().email().trim(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email().trim(),
  password: z.string().min(1),
});

function makeToken(userId: string, email: string, name: string): string {
  return jwt.sign({ userId, email, name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

// POST /api/auth/register
router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const user = await createUser(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password
    );
    const token = makeToken(user.id, user.email, user.name);
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      res.status(409).json({
        error:
          "An account with this email already exists. Please sign in instead.",
      });
      return;
    }
    req.log.error({ err }, "Registration error");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const user = findUserByEmail(parsed.data.email);
  if (!user) {
    res.status(401).json({
      error: "No account found with that email. Please sign up first.",
    });
    return;
  }

  const valid = await verifyPassword(user, parsed.data.password);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password. Please try again." });
    return;
  }

  const token = makeToken(user.id, user.email, user.name);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

export default router;
