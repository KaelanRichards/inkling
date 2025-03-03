import { apiRpc, getApiClient, InferRequestType } from "./client";

// Define the RPC endpoints
// Using underscore prefix to indicate these are only used for type inference
const _$getJournalEntries = apiRpc.journal.$get;
const _$getJournalEntriesByDate = apiRpc.journal["by-date"].$get;
const _$getJournalEntry = apiRpc.journal[":id"].$get;
const _$createJournalEntry = apiRpc.journal.$post;
const _$updateJournalEntry = apiRpc.journal[":id"].$put;
const _$deleteJournalEntry = apiRpc.journal[":id"].$delete;

// Export parameter types for use in components
export type CreateJournalEntryParams = {
  content: string;
  date: string;
};
export type UpdateJournalEntryParams = InferRequestType<typeof _$updateJournalEntry>["json"];

// Get all journal entries with pagination
export async function getJournalEntries(limit?: number, offset?: number) {
  const client = await getApiClient();
  const query: Record<string, string> = {};
  
  if (limit !== undefined) {
    query.limit = limit.toString();
  }
  
  if (offset !== undefined) {
    query.offset = offset.toString();
  }
  
  const response = await client.journal.$get({ query });
  return response.json();
}

// Get journal entries by date
export async function getJournalEntriesByDate(date: string) {
  const client = await getApiClient();
  const response = await client.journal["by-date"].$get({ 
    query: { date } 
  });
  return response.json();
}

// Get a specific journal entry
export async function getJournalEntry(id: number) {
  const client = await getApiClient();
  const response = await client.journal[":id"].$get({
    param: { id: id.toString() }
  });
  return response.json();
}

// Create a new journal entry
export async function createJournalEntry(params: CreateJournalEntryParams) {
  const client = await getApiClient();
  // Convert string date to Date object if needed by the API
  const apiParams = {
    content: params.content,
    date: new Date(params.date)
  };
  
  const response = await client.journal.$post({ 
    json: apiParams 
  });
  return response.json();
}

// Update a journal entry
export async function updateJournalEntry(id: number, params: UpdateJournalEntryParams) {
  const client = await getApiClient();
  const response = await client.journal[":id"].$put({
    param: { id: id.toString() },
    json: params 
  });
  return response.json();
}

// Delete a journal entry
export async function deleteJournalEntry(id: number) {
  const client = await getApiClient();
  const response = await client.journal[":id"].$delete({
    param: { id: id.toString() }
  });
  return response.json();
} 