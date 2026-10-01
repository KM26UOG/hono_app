import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { db } from "../db/db.ts";
import { ApiKeyTable, UserTable } from "../db/schema.ts";
import {
  generateApiKey,
  hashPassword,
  verifyPassword,
} from "../../lib/crypto.ts";
import { jwt, sign } from "hono/jwt";
import { env } from "../data/env.ts";
import { and, eq } from "drizzle-orm";

type JwtEnv = {
  Variables: {
    jwtPayload: { sub: string; email: string; exp: number };
  };
};
const app = new Hono<JwtEnv>();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
});

app.use(jwt({ secret: env.JWT_SECRET, alg: "HS256" }));

app.get("/", async (c) => {
  const { sub: userId } = c.var.jwtPayload;
  const keys = await db.query.ApiKeyTable.findMany({
    where: { userId },
    columns: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });
  if (!keys) {
    return c.json({ error: "No API keys found" }, 404);
  }
  return c.json(keys);
});

app.post("/", sValidator("json", createApiKeySchema), async (c) => {
  const { sub: userId } = c.var.jwtPayload;
  const { name } = await c.req.valid("json");
  const { hash, prefix, raw } = generateApiKey();
  const [apiKey] = await db
    .insert(ApiKeyTable)
    .values({ name, userId, keyHash: hash, keyPrefix: prefix })
    .returning({
      id: ApiKeyTable.id,
    });

  return c.json({ key: raw, id: apiKey.id }, 201);
});

app.delete("/:id", async (c) => {
  const { sub: userId } = c.var.jwtPayload;
  const id = c.req.param("id");

  await db
    .delete(ApiKeyTable)
    .where(and(eq(ApiKeyTable.id, id), eq(ApiKeyTable.userId, userId)));

  return c.body(null, 204);
});

export default app;
