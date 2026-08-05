import { db } from "./db.server";
import * as crypto from "crypto";
import * as argon2 from "argon2";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Hash a password using Argon2id (memory-hard, secure).
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19 * 1024, // 19 MB
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Create a new session for a user.
 */
export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  return sessionId;
}

/**
 * Get the user from a session ID.
 * Returns null if session is expired or not found.
 */
export async function getUserFromSession(
  sessionId: string,
): Promise<{ id: string; name: string } | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!session) return null;

  // Check if expired
  if (new Date() > session.expiresAt) {
    await db.session.delete({ where: { id: sessionId } });
    return null;
  }

  // Refresh expiration
  await db.session.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
  });

  return session.user;
}

/**
 * Delete a session (logout).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.session.delete({ where: { id: sessionId } }).catch(() => {
    // Session already deleted
  });
}

/**
 * Authenticate a user by name and password.
 * Returns user ID if successful, null otherwise.
 */
export async function authenticateUser(
  name: string,
  password: string,
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { name },
    select: { id: true, password: true },
  });

  if (!user || !user.password) return null;
  if (!(await verifyPassword(password, user.password))) return null;

  return user.id;
}
