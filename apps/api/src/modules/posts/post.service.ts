import { db, eq, type NewPost, posts } from "@repo/db";

export const postService = {
  createPost,
  getPosts,
};

async function createPost(post: NewPost) {
  const newPost = await db.insert(posts).values(post).returning();
  return newPost;
}

async function getPosts() {
  const allPosts = await db.select().from(posts);
  return allPosts;
}
