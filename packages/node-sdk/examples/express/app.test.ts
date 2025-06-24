import request from "supertest";
import app, { todos } from "./app";
import { beforeEach, describe, it, expect, beforeAll } from "vitest";

import bucket from "./bucket";

beforeAll(async () => await bucket.initialize());
beforeEach(() => {
  bucket.featureOverrides = () => ({
    "show-todos": true,
  });
});

describe("API Tests", () => {
  it("should return 200 for the root endpoint", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Ready to manage some TODOs!" });
  });

  it("should return todos", async () => {
    const response = await request(app).get("/todos");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ todos });
  });

  it("should return no todos when list is disabled", async () => {
    bucket.featureOverrides = () => ({
      "show-todos": false,
    });
    const response = await request(app).get("/todos");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ todos: [] });
  });
});
