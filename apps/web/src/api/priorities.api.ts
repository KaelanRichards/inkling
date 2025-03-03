import { apiRpc, getApiClient, InferRequestType } from "./client";

// Define the RPC endpoints
// Using underscore prefix to indicate these are only used for type inference
const _$getPriorities = apiRpc.priorities.$get;
const _$getPrioritiesByDate = apiRpc.priorities["by-date"].$get;
const _$getPriority = apiRpc.priorities[":id"].$get;
const _$createPriority = apiRpc.priorities.$post;
const _$updatePriority = apiRpc.priorities[":id"].$put;
const _$togglePriority = apiRpc.priorities[":id"].toggle.$put;
const _$updatePriorityRank = apiRpc.priorities[":id"].rank.$put;
const _$deletePriority = apiRpc.priorities[":id"].$delete;

// Export parameter types for use in components
export type CreatePriorityParams = InferRequestType<typeof _$createPriority>["json"];
export type UpdatePriorityParams = InferRequestType<typeof _$updatePriority>["json"];
export type UpdatePriorityRankParams = InferRequestType<typeof _$updatePriorityRank>["json"];

// Get all priorities
export async function getPriorities() {
  const client = await getApiClient();
  const response = await client.priorities.$get();
  return response.json();
}

// Get priorities by date
export async function getPrioritiesByDate(date: string) {
  const client = await getApiClient();
  const response = await client.priorities["by-date"].$get({ 
    query: { date } 
  });
  return response.json();
}

// Get a specific priority
export async function getPriority(params: { id: number }) {
  const client = await getApiClient();
  const response = await client.priorities[":id"].$get({
    param: { id: params.id.toString() }
  });
  return response.json();
}

// Create a new priority
export async function createPriority(params: CreatePriorityParams) {
  const client = await getApiClient();
  const response = await client.priorities.$post({ 
    json: params 
  });
  return response.json();
}

// Update a priority
export async function updatePriority(params: { id: number, data: UpdatePriorityParams }) {
  const client = await getApiClient();
  const response = await client.priorities[":id"].$put({ 
    param: { id: params.id.toString() },
    json: params.data 
  });
  return response.json();
}

// Toggle priority completion status
export async function togglePriorityCompletion(params: { id: number }) {
  const client = await getApiClient();
  const response = await client.priorities[":id"].toggle.$put({
    param: { id: params.id.toString() }
  });
  return response.json();
}

// Update priority rank
export async function updatePriorityRank(params: { id: number, rank: number }) {
  const client = await getApiClient();
  const response = await client.priorities[":id"].rank.$put({ 
    param: { id: params.id.toString() },
    json: { rank: params.rank } 
  });
  return response.json();
}

// Delete a priority
export async function deletePriority(params: { id: number }) {
  const client = await getApiClient();
  const response = await client.priorities[":id"].$delete({
    param: { id: params.id.toString() }
  });
  return response.json();
} 