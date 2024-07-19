import express from "express";
import { bucket } from "./bucket";
import { BucketClient } from "../src";
import type { AppFlags } from "./flags";

export const app = express();

declare global {
  namespace Express {
    interface Locals {
      bucketUser: BucketClient;
    }
  }
}

app.use(express.json());
app.use((req, res, next) => {
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

  res.locals.bucketUser = bucketUser;
  next();
});

const todos = ["Buy milk", "Walk the dog"];

app.get("/", (req, res) => {
  res.locals.bucketUser.trackFeatureUsage("Front Page Viewed");
  res.send("Hello World");
});

app.get("/todos", async (req, res) => {
  const flags = res.locals.bucketUser.getFlags<AppFlags>();

  if (showTodosFlag.value === false) {
    res.locals.bucketUser.trackFeatureUsage("Front Page Viewed");
  }
  res.json({ todos });
});

app.post("/todos", (req, res) => {
  const { todo } = req.body;
  if (typeof todo !== "string") {
    return res.status(400).json({ error: "Invalid todo" });
  }

  todos.push(todo);

  res.locals.bucketUser.trackFeatureUsage("Created todo");
  res.json({ todo });
});

app.delete("/todos/:idx", (req, res) => {
  const idx = parseInt(req.params.idx);
  if (isNaN(idx) || idx < 0 || idx >= todos.length) {
    return res.status(400).json({ error: "Invalid index" });
  }

  todos.splice(idx, 1);

  res.locals.bucketUser.trackFeatureUsage("Deleted todo");
  res.json({});
});
