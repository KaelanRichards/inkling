import OpenAI from "openai";
import { db, eq, and, desc, journalEntries, priorities, contextEntities, entityRelationships, clarifyingQuestions, type NewPriority, type NewClarifyingQuestion, type NewContextEntity, type NewEntityRelationship } from "@repo/db";

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
    
    // Get recent journal entries for context (last 5 entries)
    const recentEntries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.date))
      .limit(5);
    
    // Get recent context entities to provide context
    const recentEntities = await db
      .select()
      .from(contextEntities)
      .where(eq(contextEntities.userId, userId))
      .orderBy(desc(contextEntities.updatedAt))
      .limit(15);
    
    // Get existing entity relationships
    const entityRelationshipsData = await db
      .select()
      .from(entityRelationships)
      .where(eq(entityRelationships.userId, userId))
      .limit(20);
    
    // Format relationships for context
    const formattedRelationships = entityRelationshipsData.map(rel => {
      const sourceEntity = recentEntities.find(e => e.id === rel.sourceEntityId);
      const targetEntity = recentEntities.find(e => e.id === rel.targetEntityId);
      
      if (sourceEntity && targetEntity) {
        return {
          source: { type: sourceEntity.type, name: sourceEntity.name },
          relationship: rel.relationshipType,
          target: { type: targetEntity.type, name: targetEntity.name }
        };
      }
      return null;
    }).filter(Boolean);
    
    // Analyze the entry with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a journaling app designed for startup CTOs and executives. 
          Your task is to analyze journal entries and extract:
          
          1. Key priorities (actionable items)
             - Focus on concrete, actionable tasks that the user needs to accomplish
             - Prioritize items that seem urgent or important based on context
             - Ensure priorities are specific and clear enough to be actionable
          
          2. Important entities (people, roles, projects, products, strategies)
             - Extract entities mentioned in the entry with their relationships
             - For people: include their role if mentioned
             - For projects/products: include their status or phase if mentioned
             - For strategies: capture key objectives or goals
          
          3. Entity relationships
             - Identify how entities relate to each other
             - Examples: "manages", "reports_to", "part_of", "leads", "depends_on"
          
          4. Potential clarifying questions
             - Ask questions that would help build a better mental model
             - Focus on ambiguities or gaps in the user's context
             - Questions should be specific and directly relevant to the entry
          
          Format your response as JSON with the following structure:
          {
            "priorities": [
              { "content": "string", "rank": number }
            ],
            "entities": [
              { "type": "person|role|project|product|strategy", "name": "string", "description": "string" }
            ],
            "relationships": [
              { "sourceEntityName": "string", "targetEntityName": "string", "relationshipType": "string" }
            ],
            "clarifyingQuestions": [
              { "question": "string" }
            ]
          }
          
          Limit to 3-5 priorities, ranked by importance (1 being highest).
          Limit to 0-5 entities that are clearly mentioned.
          Limit to 0-3 relationships between entities.
          Limit to 0-2 clarifying questions that would help build better context.`
        },
        {
          role: "user", 
          content: `Here is my journal entry: "${entry?.content}"
          
          ${recentEntries.length > 1 ? `For context, here are my recent journal entries:
          ${recentEntries.slice(1).map(e => `- ${e.content}`).join('\n')}` : ""}
          
          ${recentEntities.length > 0 ? `For context, here are some entities I've mentioned before: 
          ${JSON.stringify(recentEntities.map(e => ({ type: e.type, name: e.name, description: e.description })))}` : ""}
          
          ${formattedRelationships.length > 0 ? `For context, here are some known relationships between entities:
          ${JSON.stringify(formattedRelationships)}` : ""}
          
          Please analyze this entry and extract priorities, entities, relationships, and potential clarifying questions.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const analysis = JSON.parse(response.choices[0]?.message.content ?? "{}");
    
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
    const newEntities = new Map();
    if (analysis.entities && analysis.entities.length > 0) {
      for (const entity of analysis.entities) {
        // Check if entity already exists
        const existingEntities = await db
          .select()
          .from(contextEntities)
          .where(
            and(
              eq(contextEntities.userId, userId),
              eq(contextEntities.name, entity.name),
              eq(contextEntities.type, entity.type)
            )
          );
        
        if (existingEntities.length === 0) {
          // Insert new entity
          const results = await db.insert(contextEntities).values({
            type: entity.type,
            name: entity.name,
            description: entity.description || "",
            userId,
          } as NewContextEntity).returning();
          
          if (results.length > 0) {
            newEntities.set(entity.name, results[0].id);
          }
        } else {
          // Update existing entity if description has changed
          if (entity.description && entity.description !== existingEntities[0].description) {
            await db.update(contextEntities)
              .set({ description: entity.description, updatedAt: new Date() })
              .where(eq(contextEntities.id, existingEntities[0].id));
          }
          newEntities.set(entity.name, existingEntities[0].id);
        }
      }
    }
    
    // Store the relationships
    if (analysis.relationships && analysis.relationships.length > 0) {
      for (const relationship of analysis.relationships) {
        // Get entity IDs
        const sourceEntityId = newEntities.get(relationship.sourceEntityName);
        const targetEntityId = newEntities.get(relationship.targetEntityName);
        
        if (sourceEntityId && targetEntityId) {
          // Check if relationship already exists
          const existingRelationships = await db
            .select()
            .from(entityRelationships)
            .where(
              and(
                eq(entityRelationships.userId, userId),
                eq(entityRelationships.sourceEntityId, sourceEntityId),
                eq(entityRelationships.targetEntityId, targetEntityId),
                eq(entityRelationships.relationshipType, relationship.relationshipType)
              )
            );
          
          if (existingRelationships.length === 0) {
            // Insert new relationship
            await db.insert(entityRelationships).values({
              sourceEntityId,
              targetEntityId,
              relationshipType: relationship.relationshipType,
              userId,
            } as NewEntityRelationship);
          }
        }
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
    
    // Get existing priorities for context
    const existingPriorities = await db
      .select()
      .from(priorities)
      .where(
        and(
          eq(priorities.userId, userId),
          // This is a simplified version - in production you'd need proper date range queries
        )
      )
      .orderBy(priorities.rank);
    
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
          
          When identifying priorities:
          - Focus on concrete, actionable tasks that the user needs to accomplish
          - Prioritize items that seem urgent or important based on context
          - Ensure priorities are specific and clear enough to be actionable
          - Consider existing priorities the user already has
          
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
          
          ${existingPriorities.length > 0 ? `For context, here are my existing priorities:
          ${JSON.stringify(existingPriorities.map(p => ({ content: p.content, completed: p.completed })))}` : ""}
          
          Please generate a concise summary and extract key priorities.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const summary = JSON.parse(response.choices[0]?.message.content ?? "{}");
    
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
    
    // Get entity relationships
    const entityRelationshipsData = await db
      .select()
      .from(entityRelationships)
      .where(eq(entityRelationships.userId, userId))
      .limit(20);
    
    // Format relationships for context
    const formattedRelationships = entityRelationshipsData.map(rel => {
      const sourceEntity = recentEntities.find(e => e.id === rel.sourceEntityId);
      const targetEntity = recentEntities.find(e => e.id === rel.targetEntityId);
      
      if (sourceEntity && targetEntity) {
        return {
          source: { type: sourceEntity.type, name: sourceEntity.name },
          relationship: rel.relationshipType,
          target: { type: targetEntity.type, name: targetEntity.name }
        };
      }
      return null;
    }).filter(Boolean);
    
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
    
    // Get recent journal entries for context
    const recentJournalEntries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.date))
      .limit(10);
    
    // Generate new questions with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a journaling app designed for startup CTOs and executives.
          Your task is to generate thoughtful clarifying questions to help build a better mental model of the user's context.
          
          When generating questions:
          - Focus on gaps or ambiguities in the user's context
          - Ask about relationships between entities that are unclear
          - Inquire about strategic priorities or challenges that seem important
          - Ask about the status or progress of key projects or initiatives
          - Questions should be specific and directly relevant to the user's context
          
          Format your response as JSON with the following structure:
          {
            "questions": [
              { "question": "string" }
            ]
          }
          
          Generate 3-5 thoughtful questions that would help build a better mental model of the user's context.`
        },
        {
          role: "user",
          content: `Here is my context:
          
          ${recentJournalEntries.length > 0 ? `Recent journal entries:
          ${recentJournalEntries.map(e => `- ${e.content.substring(0, 200)}${e.content.length > 200 ? '...' : ''}`).join('\n')}` : ""}
          
          ${recentEntities.length > 0 ? `Entities in my context:
          ${JSON.stringify(recentEntities.map(e => ({ type: e.type, name: e.name, description: e.description })))}` : ""}
          
          ${formattedRelationships.length > 0 ? `Relationships between entities:
          ${JSON.stringify(formattedRelationships)}` : ""}
          
          Please generate thoughtful clarifying questions to help build a better mental model of my context.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const result = JSON.parse(response.choices[0]?.message.content ?? "{}");
    
    // Store the generated questions
    const newQuestions = [];
    if (result.questions && result.questions.length > 0) {
      for (const question of result.questions) {
        const results = await db.insert(clarifyingQuestions).values({
          question: question.question,
          status: "pending",
          userId,
        } as NewClarifyingQuestion).returning();
        
        if (results.length > 0) {
          newQuestions.push(results[0]);
        }
      }
    }
    
    return newQuestions;
  },
  
  async answerClarifyingQuestion(userId: string, questionId: number, answer: string) {
    // Update the question with the answer
    const results = await db
      .update(clarifyingQuestions)
      .set({ 
        answer,
        status: "answered",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(clarifyingQuestions.id, questionId),
          eq(clarifyingQuestions.userId, userId)
        )
      )
      .returning();
    
    if (!results.length) {
      throw new Error("Question not found");
    }
    
    // Get the question details
    const question = results[0];
    
    // Use the answer to enhance the context model
    // This could involve updating entity descriptions, creating new entities, or establishing relationships
    await this.enhanceContextFromAnswer(userId, question.question, answer);
    
    return question;
  },
  
  async enhanceContextFromAnswer(userId: string, question: string, answer: string) {
    // Get existing entities for context
    const existingEntities = await db
      .select()
      .from(contextEntities)
      .where(eq(contextEntities.userId, userId))
      .limit(30);
    
    // Extract insights from the answer
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a journaling app designed for startup CTOs and executives.
          Your task is to analyze a user's answer to a clarifying question and extract:
          
          1. Entities (people, roles, projects, products, strategies)
          2. Relationships between entities
          3. Updates to existing entities
          
          Format your response as JSON with the following structure:
          {
            "newEntities": [
              { "type": "person|role|project|product|strategy", "name": "string", "description": "string" }
            ],
            "relationships": [
              { "sourceEntityName": "string", "targetEntityName": "string", "relationshipType": "string" }
            ],
            "entityUpdates": [
              { "name": "string", "type": "string", "updatedDescription": "string" }
            ]
          }`
        },
        {
          role: "user",
          content: `Question: "${question}"
          
          Answer: "${answer}"
          
          ${existingEntities.length > 0 ? `Existing entities:
          ${JSON.stringify(existingEntities.map(e => ({ type: e.type, name: e.name, description: e.description })))}` : ""}
          
          Please analyze this answer and extract entities, relationships, and updates.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const analysis = JSON.parse(response.choices[0]?.message.content ?? "{}");
    
    // Process new entities
    const entityIdMap = new Map();
    if (analysis.newEntities && analysis.newEntities.length > 0) {
      for (const entity of analysis.newEntities) {
        // Check if entity already exists
        const existingEntity = existingEntities.find(e => 
          e.name.toLowerCase() === entity.name.toLowerCase() && e.type === entity.type
        );
        
        if (!existingEntity) {
          // Insert new entity
          const results = await db.insert(contextEntities).values({
            type: entity.type,
            name: entity.name,
            description: entity.description || "",
            userId,
          } as NewContextEntity).returning();
          
          if (results.length > 0) {
            entityIdMap.set(entity.name, results[0].id);
          }
        } else {
          entityIdMap.set(entity.name, existingEntity.id);
        }
      }
    }
    
    // Process entity updates
    if (analysis.entityUpdates && analysis.entityUpdates.length > 0) {
      for (const update of analysis.entityUpdates) {
        // Find the entity to update
        const existingEntity = existingEntities.find(e => 
          e.name.toLowerCase() === update.name.toLowerCase() && e.type === update.type
        );
        
        if (existingEntity) {
          // Update the entity description
          await db.update(contextEntities)
            .set({ 
              description: update.updatedDescription,
              updatedAt: new Date()
            })
            .where(eq(contextEntities.id, existingEntity.id));
          
          entityIdMap.set(update.name, existingEntity.id);
        }
      }
    }
    
    // Process relationships
    if (analysis.relationships && analysis.relationships.length > 0) {
      for (const relationship of analysis.relationships) {
        // Get source and target entity IDs
        let sourceEntityId = entityIdMap.get(relationship.sourceEntityName);
        let targetEntityId = entityIdMap.get(relationship.targetEntityName);
        
        // If not in our map, try to find in existing entities
        if (!sourceEntityId) {
          const sourceEntity = existingEntities.find(e => e.name.toLowerCase() === relationship.sourceEntityName.toLowerCase());
          if (sourceEntity) {
            sourceEntityId = sourceEntity.id;
          }
        }
        
        if (!targetEntityId) {
          const targetEntity = existingEntities.find(e => e.name.toLowerCase() === relationship.targetEntityName.toLowerCase());
          if (targetEntity) {
            targetEntityId = targetEntity.id;
          }
        }
        
        // Create relationship if we have both entities
        if (sourceEntityId && targetEntityId) {
          await db.insert(entityRelationships).values({
            sourceEntityId,
            targetEntityId,
            relationshipType: relationship.relationshipType,
            userId,
          } as NewEntityRelationship).onConflictDoNothing();
        }
      }
    }
    
    return analysis;
  }
}; 