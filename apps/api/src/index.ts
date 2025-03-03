import { Hono } from "hono";
import { cors } from "hono/cors";

import { postRoutes } from "@/modules/posts";
import { journalRoutes } from "@/modules/journal/journal.routes";
import { prioritiesRoutes } from "@/modules/priorities/priorities.routes";
import { aiRoutes } from "@/modules/ai/ai.routes";

import { logger } from "hono/logger";
import { errorHandler } from "@/pkg/middleware/error";
import { webhookRoutes } from "@/modules/webhooks/webhook.routes";

const app = new Hono();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.get("/health", (c) => {
  return c.text("OK");
});

const routes = app
  .basePath("/api")
  .use("*", errorHandler())
  .route("/webhooks", webhookRoutes)
  .route("/posts", postRoutes)
  .route("/journal", journalRoutes)
  .route("/priorities", prioritiesRoutes)
  .route("/ai", aiRoutes);

export type AppType = typeof routes;

export default {
  port: 3004,
  fetch: app.fetch,
  idleTimeout: 30,
};
