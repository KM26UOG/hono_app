import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { db } from "../db/db.ts";
import { AuthorTable } from "../db/schema.ts";
import { eq } from "drizzle-orm/sql/expressions/conditions";
import { apiKeyAuth, type ApiKeyEnv } from "../middleware/auth.ts";

const app = new Hono();
const protectedApp = new Hono<ApiKeyEnv>();
protectedApp.use(apiKeyAuth);

// Mock data for authors fro testing purposes
const authors: { id: string; name: string; birthday?: Date | null }[] = [
  { id: "1", name: "Author One" },
  { id: "2", name: "Author Two" },
];
// Schemas for validation
const createAuthorSchema = z.object({
  name: z.string().min(1),
  birthday: z.coerce.date().optional(),
});
const updateAuthorSchema = z.object({
  name: z.string().min(1).optional(),
  birthday: z.coerce.date().nullable().optional(),
});

//Free for anyone to access return list of authors/single auth
app.get("/", async (c) => {
  const authors = await db.query.AuthorTable.findMany();
  return c.json(authors);
});
//get author by id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const author = await db.query.AuthorTable.findFirst({ where: { id } });

  if (!author) {
    return c.json({ error: "Author not found" }, 404);
  }
  return c.json(author);
});

//role baseed access through middleware(update/create/delete)

//create new author
protectedApp.post("/", sValidator("json", createAuthorSchema), async (c) => {
  const data = c.req.valid("json");
  const [newAuthor] = await db.insert(AuthorTable).values(data).returning();
  return c.json(newAuthor, 201);
});

//update author by id
protectedApp.put("/:id", sValidator("json", updateAuthorSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const [author] = await db
    .update(AuthorTable)
    .set(data)
    .where(eq(AuthorTable.id, id))
    .returning();

  if (!author) {
    return c.json({ error: "Author not found" }, 404);
  }
  if (data.name !== undefined) {
    author.name = data.name;
  }
  if (data.birthday !== undefined) {
    author.birthday = data.birthday;
  }

  return c.json(author, 201);
});

//delete author by id
protectedApp.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(AuthorTable).where(eq(AuthorTable.id, id));
  return c.body(null, 204);
});
app.route("/", protectedApp);
export default app;
