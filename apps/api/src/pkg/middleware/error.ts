import { logger } from "@repo/logs";
import type { MiddlewareHandler } from "hono";

// Changed to a factory function for consistency
export const errorHandler = (): MiddlewareHandler => {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      logger.error(error);

      if (error instanceof Error) {
        return c.json(
          {
            success: false,
            message: error.message,
          },
          error.name === "ValidationError" ? 400 : 500,
        );
      }

      return c.json(
        {
          success: false,
          message: "Internal Server Error",
        },
        500,
      );
    }
  };
};
