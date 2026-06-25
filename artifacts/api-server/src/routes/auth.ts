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
//
// Security note: registration is intentionally decoupled from immediate login.
// We return the same 200 response regardless of whether the email is already
// registered. This prevents user-enumeration: an attacker cannot distinguish
// a new account from an existing one by observing status codes or bodies.
// Clients must call /auth/login to obtain a session token.
router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten(),
    });
    return;
  }

  const GENERIC_OK = {
    message:
      "If this email address is not already registered, your account has been created. Please log in to continue.",
  } as const;

  try {
    await createUser(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      // Intentional no-op: return the same response as a successful registration
      // so callers cannot determine whether the email is already enrolled.
      res.status(200).json(GENERIC_OK);
      return;
    }
    req.log.error({ err }, "Registration error");
    res.status(500).json({ error: "Registration failed. Please try again." });
    return;
  }

  res.status(200).json(GENERIC_OK);
});

// POST /api/auth/login
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const user = findUserByEmail(parsed.data.email);
  // Use a single generic message for both "unknown email" and "wrong password"
  // so the endpoint cannot be used to enumerate registered email addresses.
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const valid = await verifyPassword(user, parsed.data.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const token = makeToken(user.id, user.email, user.name);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

export default router;
