import express from "express";
import bucket from "./bucket";
import { BoundBucketClient } from "../src/types";

// Augment the Express types to include the `bucketUser` property on the `res.locals` object
// This will allow us to access the BucketClient instance in our route handlers
// without having to pass it around manually
declare global {
  namespace Express {
    interface Locals {
      bucketUser: BoundBucketClient;
    }
  }
}

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  // Create a new BucketClient instance by calling the `withUser` and `withCompany` methods,
  // passing the user and company IDs from the request headers.
  // The original `bucket` instance is not modified, so we can safely use it in other parts of our application.
  //
  // We also set some attributes on the user and company objects, which will be sent to the Bucket API.
  const bucketUser = bucket
    .withUser(req.headers["x-bucket-user-id"] as string, {
      attributes: {
        role: req.headers["x-bucket-is-admin"] ? "admin" : "user",
      },
    })
    .withCompany(req.headers["x-bucket-company-id"] as string, {
      attributes: {
        betaUser: !!req.headers["x-bucket-company-beta-user"],
      },
    });

  // Store the BucketClient instance in the `res.locals` object so we can access it in our route handlers
  res.locals.bucketUser = bucketUser;
  next();
});

const todos = ["Buy milk", "Walk the dog"];

app.get("/", (_req, res) => {
  res.locals.bucketUser.trackFeatureUsage("Front Page Viewed");
  res.json({ message: "Ready to manage some TODOs!" });
});

app.get("/todos", async (_req, res) => {
  // Return todos if the feature is enabled for the user
  // We use the `getFeatures` method to check if the user has the "show-todos" feature enabled.
  if (res.locals.bucketUser.getFeatures()["show-todos"]) {
    res.locals.bucketUser.trackFeatureUsage("Got todos");

    return res.json({ todos });
  }

  // Return no todos if the feature is disabled for the user
  return res.json({ todos: [] });
});

app.post("/todos", (req, res) => {
  const { todo } = req.body;

  if (typeof todo !== "string") {
    return res.status(400).json({ error: "Invalid todo" });
  }

  // Check if the user has the "create-todos" feature enabled
  if (res.locals.bucketUser.getFeatures()["create-todos"]) {
    // Track the feature usage, including the todo that was created (for analytics)
    res.locals.bucketUser.trackFeatureUsage("Created todo", {
      attributes: { todo },
    });

    todos.push(todo);

    return res.status(201).json({ todo });
  }

  res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

app.delete("/todos/:idx", (req, res) => {
  const idx = parseInt(req.params.idx);

  if (isNaN(idx) || idx < 0 || idx >= todos.length) {
    return res.status(400).json({ error: "Invalid index" });
  }

  if (res.locals.bucketUser.getFeatures()["delete-todos"]) {
    todos.splice(idx, 1);

    res.locals.bucketUser.trackFeatureUsage("Deleted todo");
    res.json({});
  }

  res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

export default app;
