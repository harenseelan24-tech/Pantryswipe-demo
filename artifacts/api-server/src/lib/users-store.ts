import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readUsers(): StoredUser[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
}

export function findUserById(id: string): StoredUser | undefined {
  const users = readUsers();
  return users.find((u) => u.id === id);
}

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<StoredUser> {
  const users = readUsers();
  const existing = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim()
  );
  if (existing) throw new Error("EMAIL_EXISTS");

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser: StoredUser = {
    id: randomUUID(),
    email: email.toLowerCase().trim(),
    name: name.trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  writeUsers(users);
  return newUser;
}

export async function verifyPassword(
  user: StoredUser,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}
