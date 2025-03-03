import { apiRpc, getApiClient, InferRequestType } from "./client";

// Define the RPC endpoints
// Using underscore prefix to indicate these are only used for type inference
const _$analyzeJournalEntry = apiRpc.ai["analyze-entry"][":id"].$post;
const _$getDailySummary = apiRpc.ai["daily-summary"].$get;
const _$getClarifyingQuestions = apiRpc.ai["clarifying-questions"].$get;
const _$answerClarifyingQuestion = apiRpc.ai["answer-question"][":id"].$post;

// Export parameter types for use in components
export type AnswerQuestionParams = InferRequestType<typeof _$answerClarifyingQuestion>["json"];

// Analyze a journal entry
export async function analyzeJournalEntry(id: number) {
  const client = await getApiClient();
  const response = await client.ai["analyze-entry"][":id"].$post({
    param: { id: String(id) }
  });
  return response.json();
}

// Generate daily summary and priorities
export async function getDailySummary() {
  const client = await getApiClient();
  const response = await client.ai["daily-summary"].$get();
  return response.json();
}

// Get clarifying questions
export async function getClarifyingQuestions() {
  const client = await getApiClient();
  const response = await client.ai["clarifying-questions"].$get();
  return response.json();
}

// Generate new clarifying questions
export async function generateClarifyingQuestions() {
  const client = await getApiClient();
  const response = await client.ai["clarifying-questions"].$get();
  return response.json();
}

// Answer a clarifying question
export async function answerClarifyingQuestion(id: number, answer: string) {
  const client = await getApiClient();
  const response = await client.ai["answer-question"][":id"].$post({
    param: { id: String(id) },
    json: { answer }
  });
  return response.json();
} 