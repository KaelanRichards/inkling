import { apiRpc, getApiClient, InferRequestType } from "./client";

// Define the RPC endpoints
// Using underscore prefix to indicate these are only used for type inference
const _$analyzeJournalEntry = apiRpc.ai.analyze[":id"].$post;
const _$getDailySummary = apiRpc.ai.summary.$get;
const _$getClarifyingQuestions = apiRpc.ai.questions.$get;
const _$answerClarifyingQuestion = apiRpc.ai.questions[":id"].answer.$post;

// Export parameter types for use in components
export type AnswerQuestionParams = InferRequestType<typeof _$answerClarifyingQuestion>["json"];

// Analyze a journal entry
export async function analyzeJournalEntry(id: number) {
  const client = await getApiClient();
  const response = await client.ai.analyze[":id"].$post({
    param: { id: id.toString() }
  });
  return response.json();
}

// Get daily summary
export async function getDailySummary(date?: string) {
  const client = await getApiClient();
  
  // Use today's date if none provided
  const today = new Date().toISOString().split('T')[0];
  const queryDate = date || today;
  
  const response = await client.ai.summary.$get({ 
    query: { date: queryDate as string }
  });
  return response.json();
}

// Get clarifying questions
export async function getClarifyingQuestions() {
  const client = await getApiClient();
  const response = await client.ai.questions.$get();
  return response.json();
}

// Generate new clarifying questions - this is a mock function that will be implemented later
export async function generateClarifyingQuestions() {
  // For now, we'll just return the existing questions
  return getClarifyingQuestions();
}

// Answer a clarifying question
export async function answerClarifyingQuestion(id: number, answer: string) {
  const client = await getApiClient();
  const response = await client.ai.questions[":id"].answer.$post({ 
    param: { id: id.toString() },
    json: { answer } 
  });
  return response.json();
} 