import { apiRpc, getApiClient, InferRequestType } from "./client";

// Using underscore prefix to indicate it is only used for type inference
const _$createPost = apiRpc.posts.$post;

export async function getPosts() {
  const client = await getApiClient();

  const response = await client.posts.$get();
  return response.json();
}

export type CreatePostParams = InferRequestType<typeof _$createPost>["json"];
export async function createPost(params: CreatePostParams) {
  const client = await getApiClient();

  const response = await client.posts.$post({ json: params });
  return response.json();
}
