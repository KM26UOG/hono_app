import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { db } from "../db/db.ts";
import { UserTable } from "../db/schema.ts";
import { hashPassword, verifyPassword } from "../../lib/crypto.ts";
import { sign } from "hono/jwt";
import { env } from "../data/env.ts";

const JWT_EXPIRATION_SECONDS = 15 * 60; // 15mins

const app = new Hono();

const registerSchema = z.object({
  email: z.email().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email().min(1),
  password: z.string().min(1),
});

//creating new users
app.post("/register", sValidator("json", registerSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  // Check if user already exists
  const existingUser = await db.query.UserTable.findFirst({
    where: { email },
  });
  if (existingUser) {
    return c.json({ error: "User already exists" }, 409);
  }
  // Hash password
  const passwordHash = await hashPassword(password);
  // Create user
  const [newUser] = await db
    .insert(UserTable)
    .values({ email, passwordHash })
    .returning({ id: UserTable.id, email: UserTable.email });
  return c.json(newUser, 201);
});

//logging in
app.post("/login", sValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  // Check if user already exists
  const user = await db.query.UserTable.findFirst({
    where: { email },
  });
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const timeNow = Math.floor(Date.now() / 1000);
  const token = await sign(
    { exp: timeNow + JWT_EXPIRATION_SECONDS, sub: user.id, email: user.email },
    env.JWT_SECRET,
    "HS256",
  );
  return c.json({ token });
});

export default app;
