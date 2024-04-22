import { integer, text, sqliteTable, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
});

export const ideas = sqliteTable(
	'ideas',
	{
		id: integer('id', { mode: 'number' })
			.primaryKey({ autoIncrement: true })
			.notNull(),
		text: text('text').notNull(),
		status: text('status', {
			enum: ['approved', 'rejected', 'pending'],
		}).notNull(),
		creator: text('creator_id')
			.references(() => users.id)
			.notNull(),
		team: text('team_id').notNull(),
	},
	(table) => {
		return {
			teamIdx: index('team_idx').on(table.team),
		};
	},
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
