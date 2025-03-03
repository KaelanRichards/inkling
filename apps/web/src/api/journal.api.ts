import { apiRpc, getApiClient, InferRequestType } from "./client";

// Define types for API parameters
interface CreateJournalEntryParams {
  content: string;
  date: string;
}

interface UpdateJournalEntryParams {
  content: string;
}

// Get all journal entries with pagination
export async function getJournalEntries(limit = 20, offset = 0) {
  const client = await getApiClient();
  const query: Record<string, string> = {
    limit: String(limit),
    offset: String(offset)
  };
  
  const response = await client.journal.$get({ query });
  return response.json();
}

// Get journal entries by date with pagination
export async function getJournalEntriesByDate(date: string, limit = 20, offset = 0) {
  const client = await getApiClient();
  const query: Record<string, string> = {
    date,
    limit: String(limit),
    offset: String(offset)
  };
  
  const response = await client.journal["by-date"].$get({ query });
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
  const response = await client.journal.$post({ 
    json: params
  });
  return response.json();
}

// Update a journal entry
export async function updateJournalEntry(id: number, content: string) {
  const client = await getApiClient();
  const response = await client.journal[":id"].$put({
    param: { id: id.toString() },
    json: { content } 
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