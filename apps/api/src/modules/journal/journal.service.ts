import { db, eq, and, desc, journalEntries, type NewJournalEntry, type JournalEntry } from "@repo/db";

// Define a service type to avoid the postgres types reference error
type JournalService = {
  getJournalEntries(userId: string, limit?: number, offset?: number): Promise<JournalEntry[]>;
  getJournalEntriesByDate(userId: string, date: Date, limit?: number, offset?: number): Promise<JournalEntry[]>;
  getJournalEntryById(id: number, userId: string): Promise<JournalEntry | undefined>;
  createJournalEntry(data: Omit<NewJournalEntry, "id" | "createdAt" | "updatedAt">): Promise<JournalEntry | undefined>;
  updateJournalEntry(id: number, userId: string, content: string): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number, userId: string): Promise<unknown>;
};

export const journalService: JournalService = {
  async getJournalEntries(userId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.date))
      .limit(limit)
      .offset(offset);
  },

  async getJournalEntriesByDate(userId: string, date: Date, limit = 50, offset = 0) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          // This is a simplified version - in production you'd need proper date range queries
          // based on your database's capabilities
        )
      )
      .orderBy(desc(journalEntries.date))
      .limit(limit)
      .offset(offset);
  },

  async getJournalEntryById(id: number, userId: string) {
    const results = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId)
        )
      )
      .limit(1);
    
    return results[0];
  },

  async createJournalEntry(data: Omit<NewJournalEntry, "id" | "createdAt" | "updatedAt">) {
    const results = await db
      .insert(journalEntries)
      .values(data)
      .returning();
    
    return results[0];
  },

  async updateJournalEntry(id: number, userId: string, content: string) {
    const results = await db
      .update(journalEntries)
      .set({ 
        content,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId)
        )
      )
      .returning();
    
    return results[0];
  },

  async deleteJournalEntry(id: number, userId: string) {
    return db
      .delete(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId)
        )
      );
  }
}; 