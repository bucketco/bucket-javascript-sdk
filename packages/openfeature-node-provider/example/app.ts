import express from "express";
import "./bucket";
import { EvaluationContext, OpenFeature } from "@openfeature/server-sdk";
import provider from "./bucket";

// In the following, we assume that targetingKey is a unique identifier for the user
type Context = EvaluationContext & {
  targetingKey: string;
  companyId: string;
};

// Augment the Express types to include the some context property on the `res.locals` object
declare global {
  namespace Express {
    interface Locals {
      context: Context;
      track: (
        event: string,
        attributes?: Record<string, any>,
      ) => Promise<boolean>;
    }
  }
}

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const ofContext = {
    targetingKey: "user42",
    companyId: "company99",
  };
  res.locals.context = ofContext;
  res.locals.track = (event: string, attributes?: Record<string, any>) => {
    return provider.client.track(ofContext.targetingKey, event, {
      attributes,
      companyId: ofContext.companyId,
    });
  };
  next();
});

const todos = ["Buy milk", "Walk the dog"];

app.get("/", (_req, res) => {
  res.locals.track("front-page-viewed");
  res.json({ message: "Ready to manage some TODOs!" });
});

app.get("/todos", async (req, res) => {
  // Return todos if the feature is enabled for the user
  // We use the `getFeatures` method to check if the user has the "show-todo" feature enabled.
  // Note that "show-todo" is a feature that we defined in the `Features` interface in the `bucket.ts` file.
  // and that the indexing for feature name below is type-checked at compile time.
  const isEnabled = await OpenFeature.getClient().getBooleanValue(
    "show-todo",
    false,
    res.locals.context,
  );

  if (isEnabled) {
    res.locals.track("show-todo");

    // You can instead also send any custom event if you prefer, including attributes.
    // provider.client.track(res.locals.context.targetingKey, "Todo's viewed", { attributes: { access: "api" } });

    return res.json({ todos });
  }

  return res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

app.post("/todos", async (req, res) => {
  const { todo } = req.body;

  if (typeof todo !== "string") {
    return res.status(400).json({ error: "Invalid todo" });
  }

  const isEnabled = await OpenFeature.getClient().getBooleanValue(
    "create-todo",
    false,
    res.locals.context,
  );

  // Check if the user has the "create-todos" feature enabled
  if (isEnabled) {
    // Track the feature usage
    res.locals.track("create-todo");
    todos.push(todo);

    return res.status(201).json({ todo });
  }

  res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

app.delete("/todos/:idx", async (req, res) => {
  const idx = parseInt(req.params.idx);

  if (isNaN(idx) || idx < 0 || idx >= todos.length) {
    return res.status(400).json({ error: "Invalid index" });
  }

  const isEnabled = await OpenFeature.getClient().getBooleanValue(
    "delete-todo",
    false,
    res.locals.context,
  );

  if (isEnabled) {
    todos.splice(idx, 1);

    res.locals.track("delete-todo");
    return res.json({});
  }

  res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

export default app;
