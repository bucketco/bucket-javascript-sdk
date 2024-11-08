import bucket from "./bucket";
import express from "express";
import { BoundBucketClient } from "../src";

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
  // Extract the user and company IDs from the request headers
  // You'll want to use a proper authentication and identification
  // mechanism in a real-world application
  const { user, company } = extractBucketContextFromHeader(req);

  // Create a new BoundBucketClient instance by calling the `bindClient` method on a `BucketClient` instance
  // This will create a new instance that is bound to the user/company given.
  const bucketUser = bucket.bindClient({ user, company });

  // Store the BoundBucketClient instance in the `res.locals` object so we can access it in our route handlers
  res.locals.bucketUser = bucketUser;
  next();
});

export const todos = ["Buy milk", "Walk the dog"];

app.get("/", (_req, res) => {
  res.locals.bucketUser.track("Front Page Viewed");
  res.json({ message: "Ready to manage some TODOs!" });
});

// Return todos if the feature is enabled for the user
app.get("/todos", async (_req, res) => {
  // We use the `getFeature` method to check if the user has the "show-todos" feature enabled.
  // Note that "show-todos" is a feature that we defined in the `Features` interface in the `bucket.ts` file.
  // and that the indexing for feature name below is type-checked at compile time.
  const { isEnabled, track } = res.locals.bucketUser.getFeature("show-todos");

  if (isEnabled) {
    track();

    // You can instead also send any custom event if you prefer, including attributes.
    // res.locals.bucketUser.track("Todo's viewed", { attributes: { access: "api" } });

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

  const { track, isEnabled } = res.locals.bucketUser.getFeature("create-todos");

  // Check if the user has the "create-todos" feature enabled
  if (isEnabled) {
    // Track the feature usage
    track();
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

  const { track, isEnabled } = res.locals.bucketUser.getFeature("delete-todos");

  if (isEnabled) {
    todos.splice(idx, 1);

    track();
    res.json({});
  }

  res
    .status(403)
    .json({ error: "You do not have access to this feature yet!" });
});

export default app;

function extractBucketContextFromHeader(req: express.Request) {
  const user = req.headers["x-bucket-user-id"]
    ? {
        id: req.headers["x-bucket-user-id"] as string,
        role: req.headers["x-bucket-is-admin"] ? "admin" : "user",
      }
    : undefined;
  const company = req.headers["x-bucket-company-id"]
    ? {
        id: req.headers["x-bucket-company-id"] as string,
        betaUser: !!req.headers["x-bucket-company-beta-user"],
      }
    : undefined;
  return { user, company };
}
