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
  next();
});

const todos = ["Buy milk", "Walk the dog"];

app.get("/", (_req, res) => {
  const ofClient = OpenFeature.getClient();
  ofClient.track("front-page-viewed", res.locals.context);
  res.json({ message: "Ready to manage some TODOs!" });
});

app.get("/todos", async (req, res) => {
  // Return todos if the feature is enabled for the user
  // We use the `getFeatures` method to check if the user has the "show-todo" feature enabled.
  // Note that "show-todo" is a feature that we defined in the `Features` interface in the `bucket.ts` file.
  // and that the indexing for feature name below is type-checked at compile time.
  const ofClient = OpenFeature.getClient();
  const isEnabled = await ofClient.getBooleanValue(
    "show-todo",
    false,
    res.locals.context,
  );

  if (isEnabled) {
    ofClient.track("show-todo", res.locals.context);
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

  const ofClient = OpenFeature.getClient();
  const isEnabled = await ofClient.getBooleanValue(
    "create-todo",
    false,
    res.locals.context,
  );

  // Check if the user has the "create-todos" feature enabled
  if (isEnabled) {
    // Track the feature usage
    ofClient.track("create-todo", res.locals.context);
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

  const ofClient = OpenFeature.getClient();
  const isEnabled = await ofClient.getBooleanValue(
    "delete-todo",
    false,
    res.locals.context,
  );

  if (isEnabled) {
    todos.splice(idx, 1);

    ofClient.track("delete-todo", res.locals.context);
    return res.json({});
  }

  res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

export default app;
