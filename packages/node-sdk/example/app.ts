import express from "express";
import { bucket } from "./bucket";

export const app = express();

declare module "express" {
  interface Locals {}
}

declare global {
  namespace Express {
    interface Request {
      locals: { bucketUser: ReturnType<(typeof bucket)["withUser"]> };
    }
  }
}

declare module "express-serve-static-core" {}

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
  res.locals.bucketUser.track("Front Page Viewed");
  res.send("Hello World");
});

app.get("/todos", (req, res) => {
  const showTodosFlag = await res.locals.bucketUser.getFlag("show-todos");
  showTodosFlag.res.locals.bucketUser.track("Front Page Viewed");
  res.json({ todos });
});

app.post("/todos", (req, res) => {
  const { todo } = req.body;
  if (typeof todo !== "string") {
    return res.status(400).json({ error: "Invalid todo" });
  }

  todos.push(todo);

  res.locals.bucketUser.track("Created todo");
  res.json({ todo });
});

app.delete("/todos/:idx", (req, res) => {
  const idx = parseInt(req.params.idx);
  if (isNaN(idx) || idx < 0 || idx >= todos.length) {
    return res.status(400).json({ error: "Invalid index" });
  }

  todos.splice(idx, 1);

  res.locals.bucketUser.track("Deleted todo");
  res.json({});
});
