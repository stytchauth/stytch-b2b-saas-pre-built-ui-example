import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {
	users,
	ideas,
	type NewIdea,
	type NewUser,
	type User,
	type Idea,
} from './schema.js';
import { eq } from 'drizzle-orm';

const sqlite = new Database('./db/squircle-demo.db');
const db = drizzle(sqlite);

// inserts a new user and returns the newly created entry
export async function addUser(user: NewUser): Promise<User> {
	const result = await db.insert(users).values(user).returning();

	return result.at(0)!;
}

export async function getUser(userId: NewUser['id']): Promise<User> {
	const result = await db.select().from(users).where(eq(users.id, userId));

	return result.at(0)!;
}

export async function updateUserName(userId: User['id'], name: User['name']) {
	await db.update(users).set({ name }).where(eq(users.id, userId));
}

export async function addIdea(idea: NewIdea) {
	return await db.insert(ideas).values(idea).returning();
}

export async function deleteIdea(ideaId: Idea['id']) {
	return await db.delete(ideas).where(eq(ideas.id, ideaId)).returning();
}

// joins the ideas and users tables to select ideas with creator name
export async function getIdeas(orgId: string) {
	return await db
		.select({
			id: ideas.id,
			text: ideas.text,
			status: ideas.status,
			creator: users.name, // <= use the creator's name instead of ID
		})
		.from(ideas)
		.where(eq(ideas.team, orgId))
		.leftJoin(users, eq(ideas.creator, users.id));
}
