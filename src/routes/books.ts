import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { db } from "../db/db.ts";
import { AuthorTable, BookTable } from "../db/schema.ts";
import { eq, and } from "drizzle-orm/sql/expressions/conditions";
import { apiKeyAuth, type ApiKeyEnv } from "../middleware/auth.ts";
import { auth } from "hono/utils/basic-auth";

const app = new Hono();
const protectedApp = new Hono<ApiKeyEnv>();
protectedApp.use(apiKeyAuth);

// Mock data for authors fro testing purposes
const authors: { id: string; name: string; birthday?: Date | null }[] = [
  { id: "1", name: "Author One" },
  { id: "2", name: "Author Two" },
];
// Schemas for validation
const createBookSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  publishDate: z.coerce.date().optional(),
  pageCount: z.number().int().positive().optional(),
  authorId: z.uuid(),
});
const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  publishDate: z.coerce.date().nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  authorId: z.uuid().optional(),
});

//Free for anyone to access return list of authors/single auth
app.get("/", async (c) => {
  const authors = await db.query.BookTable.findMany({ with: { author: true } });
  return c.json(authors);
});
//get author by id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const book = await db.query.BookTable.findFirst({
    where: { id },
    with: { author: true },
  });

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }
  return c.json(book);
});

//role baseed access through middleware(update/create/delete)

//create new author
protectedApp.post("/", sValidator("json", createBookSchema), async (c) => {
  const { id: userId } = c.get("apiKeyUser");
  const data = c.req.valid("json");
  const author = await db.query.AuthorTable.findFirst({
    where: { id: data.authorId },
  });
  if (!author) {
    return c.json({ error: "Author not found" }, 400);
  }
  const [newBook] = await db
    .insert(BookTable)
    .values({ ...data, addedBy: userId })
    .returning();
  return c.json(newBook, 201);
});

//update author by id
protectedApp.put("/:id", sValidator("json", updateBookSchema), async (c) => {
  const id = c.req.param("id");
  const { id: userId, role } = c.get("apiKeyUser");
  const data = c.req.valid("json");
  if (!data.authorId) {
    const author = await db.query.AuthorTable.findFirst({
      where: { id: data.authorId },
    });
    if (!author) {
      return c.json({ error: "Author not found" }, 400);
    }
  }

  const whereClause =
    role === "admin"
      ? eq(BookTable.id, id)
      : and(eq(BookTable.id, id), eq(BookTable.addedBy, userId));
  const [book] = await db
    .update(BookTable)
    .set(data)
    .where(whereClause)
    .returning();

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }
  return c.json(book);
});

//delete author by id
protectedApp.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { id: userId, role } = c.get("apiKeyUser");
  const whereClause =
    role === "admin"
      ? eq(BookTable.id, id)
      : and(eq(BookTable.id, id), eq(BookTable.addedBy, userId));

  await db.delete(BookTable).where(whereClause);

  return c.body(null, 204);
});
app.route("/", protectedApp);
export default app;
