import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./test/mocks/server.js";

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request) {
      console.error("Unhandled %s %s", request.method, request.url);
    },
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
