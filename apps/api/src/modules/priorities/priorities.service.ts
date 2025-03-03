import { db, eq, and, desc, priorities, type NewPriority } from "@repo/db";

export const prioritiesService = {
  async getPriorities(userId: string) {
    return db
      .select()
      .from(priorities)
      .where(eq(priorities.userId, userId))
      .orderBy(desc(priorities.date), priorities.rank);
  },

  async getPrioritiesByDate(userId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return db
      .select()
      .from(priorities)
      .where(
        and(
          eq(priorities.userId, userId),
          // This is a simplified version - in production you'd need proper date range queries
          // based on your database's capabilities
        )
      )
      .orderBy(priorities.rank);
  },

  async getPriorityById(id: number, userId: string) {
    const results = await db
      .select()
      .from(priorities)
      .where(
        and(
          eq(priorities.id, id),
          eq(priorities.userId, userId)
        )
      )
      .limit(1);
    
    return results[0];
  },

  async createPriority(data: Omit<NewPriority, "id" | "createdAt" | "updatedAt">) {
    const results = await db
      .insert(priorities)
      .values(data)
      .returning();
    
    return results[0];
  },

  async updatePriority(id: number, userId: string, data: Partial<Omit<NewPriority, "id" | "userId" | "createdAt" | "updatedAt">>) {
    const results = await db
      .update(priorities)
      .set({ 
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(priorities.id, id),
          eq(priorities.userId, userId)
        )
      )
      .returning();
    
    return results[0];
  },

  async deletePriority(id: number, userId: string) {
    return db
      .delete(priorities)
      .where(
        and(
          eq(priorities.id, id),
          eq(priorities.userId, userId)
        )
      );
  },

  async togglePriorityCompletion(id: number, userId: string) {
    // First get the current priority to check its completion status
    const priority = await this.getPriorityById(id, userId);
    
    if (!priority) {
      return null;
    }
    
    // Toggle the completion status
    const results = await db
      .update(priorities)
      .set({ 
        completed: !priority.completed,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(priorities.id, id),
          eq(priorities.userId, userId)
        )
      )
      .returning();
    
    return results[0];
  },

  async updatePriorityRank(id: number, userId: string, newRank: number) {
    const results = await db
      .update(priorities)
      .set({ 
        rank: newRank,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(priorities.id, id),
          eq(priorities.userId, userId)
        )
      )
      .returning();
    
    return results[0];
  }
}; 