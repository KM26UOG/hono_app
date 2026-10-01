import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const UserTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: userRoleEnum().notNull().default("user"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
