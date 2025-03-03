import OpenAI from "openai";
import { db, eq, and, desc, journalEntries, priorities, contextEntities, clarifyingQuestions, type NewPriority, type NewClarifyingQuestion, type NewContextEntity } from "@repo/db";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const aiService = {
  async analyzeJournalEntry(userId: string, entryId: number) {
    // Get the journal entry
    const entryResults = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, entryId),
          eq(journalEntries.userId, userId)
        )
      )
      .limit(1);
    
    if (!entryResults.length) {
      throw new Error("Journal entry not found");
    }
    
    const entry = entryResults[0];
    
    // Get recent context entities to provide context
    const recentEntities = await db
      .select()
      .from(contextEntities)
      .where(eq(contextEntities.userId, userId))
      .orderBy(desc(contextEntities.updatedAt))
      .limit(10);
    
    // Analyze the entry with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a journaling app designed for startup CTOs and executives. 
          Your task is to analyze journal entries and extract:
          1. Key priorities (actionable items)
          2. Important entities (people, roles, projects, products, strategies)
          3. Potential clarifying questions to better understand the user's context
          
          Format your response as JSON with the following structure:
          {
            "priorities": [
              { "content": "string", "rank": number }
            ],
            "entities": [
              { "type": "person|role|project|product|strategy", "name": "string", "description": "string" }
            ],
            "clarifyingQuestions": [
              { "question": "string" }
            ]
          }
          
          Limit to 3-5 priorities, ranked by importance (1 being highest).
          Limit to 0-3 entities that are clearly mentioned.
          Limit to 0-2 clarifying questions that would help build better context.`
        },
        {
          role: "user", 
          content: `Here is my journal entry: "${entry?.content}"
          
          ${recentEntities.length > 0 ? `For context, here are some entities I've mentioned before: ${JSON.stringify(recentEntities.map(e => ({ type: e.type, name: e.name })))}` : ""}
          
          Please analyze this entry and extract priorities, entities, and potential clarifying questions.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const analysis = JSON.parse(response.choices[0]?.message.content ?? "");
    
    // Store the extracted priorities
    if (analysis.priorities && analysis.priorities.length > 0) {
      for (const priority of analysis.priorities) {
        await db.insert(priorities).values({
          content: priority.content,
          rank: priority.rank,
          journalEntryId: entry?.id ?? null,
          userId,
          date: entry?.date ?? new Date(),
        } as NewPriority);
      }
    }
    
    // Store the extracted entities
    if (analysis.entities && analysis.entities.length > 0) {
      for (const entity of analysis.entities) {
        await db.insert(contextEntities).values({
          type: entity.type,
          name: entity.name,
          description: entity.description || "",
          userId,
        } as NewContextEntity);
      }
    }
    
    // Store the clarifying questions
    if (analysis.clarifyingQuestions && analysis.clarifyingQuestions.length > 0) {
      for (const question of analysis.clarifyingQuestions) {
        await db.insert(clarifyingQuestions).values({
          question: question.question,
          status: "pending",
          userId,
        } as NewClarifyingQuestion);
      }
    }
    
    return analysis;
  },
  
  async generateDailySummary(userId: string, date: Date) {
    // Get journal entries for the specified date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const entries = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          // This is a simplified version - in production you'd need proper date range queries
        )
      )
      .orderBy(journalEntries.date);
    
    if (!entries.length) {
      return {
        summary: "No journal entries for this date.",
        priorities: []
      };
    }
    
    // Combine all entries for the day
    const combinedContent = entries.map(e => e.content).join("\n\n");
    
    // Generate summary with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a journaling app designed for startup CTOs and executives.
          Your task is to generate a concise daily summary and extract key priorities from the user's journal entries.
          
          Format your response as JSON with the following structure:
          {
            "summary": "A concise 2-3 sentence summary of the day's entries",
            "priorities": [
              { "content": "string", "rank": number }
            ]
          }
          
          Limit to 3-5 priorities, ranked by importance (1 being highest).`
        },
        {
          role: "user",
          content: `Here are my journal entries for today: "${combinedContent}"
          
          Please generate a concise summary and extract key priorities.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const summary = JSON.parse(response.choices[0]?.message.content ?? "");
    
    // Store the extracted priorities if they don't already exist
    if (summary.priorities && summary.priorities.length > 0) {
      // Get existing priorities for the day
      const existingPriorities = await db
        .select()
        .from(priorities)
        .where(
          and(
            eq(priorities.userId, userId),
            // This is a simplified version - in production you'd need proper date range queries
          )
        );
      
      const existingContents = new Set(existingPriorities.map(p => p.content));
      
      for (const priority of summary.priorities) {
        // Only add if this priority doesn't already exist
        if (!existingContents.has(priority.content)) {
          await db.insert(priorities).values({
            content: priority.content,
            rank: priority.rank,
            userId,
            date,
          } as NewPriority);
        }
      }
    }
    
    return summary;
  },
  
  async generateClarifyingQuestions(userId: string) {
    // Get recent context entities
    const recentEntities = await db
      .select()
      .from(contextEntities)
      .where(eq(contextEntities.userId, userId))
      .orderBy(desc(contextEntities.updatedAt))
      .limit(20);
    
    // Get existing questions that are still pending
    const pendingQuestions = await db
      .select()
      .from(clarifyingQuestions)
      .where(
        and(
          eq(clarifyingQuestions.userId, userId),
          eq(clarifyingQuestions.status, "pending")
        )
      )
      .limit(5);
    
    // If we already have pending questions, return those instead of generating new ones
    if (pendingQuestions.length > 0) {
      return pendingQuestions;
    }
    
    // Generate new questions with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a journaling app designed for startup CTOs and executives.
          Your task is to generate thoughtful clarifying questions to help build a better mental model of the user's context.
          
          Format your response as JSON with the following structure:
          {
            "questions": [
              { "question": "string" }
            ]
          }
          
          Generate 2-3 questions that would help clarify the user's context, based on the entities provided.
          Questions should be open-ended and thoughtful, designed to elicit useful information.`
        },
        {
          role: "user",
          content: `Here are some entities from my context: ${JSON.stringify(recentEntities.map(e => ({ type: e.type, name: e.name, description: e.description })))}
          
          Please generate some thoughtful clarifying questions to help build a better mental model of my context.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const questionsResponse = JSON.parse(response.choices[0]?.message.content ?? "");
    
    // Store the generated questions
    const storedQuestions = [];
    
    if (questionsResponse.questions && questionsResponse.questions.length > 0) {
      for (const q of questionsResponse.questions) {
        const result = await db.insert(clarifyingQuestions).values({
          question: q.question,
          status: "pending",
          userId,
        } as NewClarifyingQuestion).returning();
        
        if (result.length > 0) {
          storedQuestions.push(result[0]);
        }
      }
    }
    
    return storedQuestions;
  }
}; 