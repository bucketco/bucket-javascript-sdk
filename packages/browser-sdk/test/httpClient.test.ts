import { expect, test } from "vitest";

import { HttpClient } from "../src/httpClient";

const cases = [
  ["https://front.bucket.co", "https://front.bucket.co/path"],
  ["https://front.bucket.co/", "https://front.bucket.co/path"],
  ["https://front.bucket.co/basepath", "https://front.bucket.co/basepath/path"],
];

test.each(cases)(
  "url construction with `/path`: %s -> %s",
  (base, expected) => {
    const client = new HttpClient("publishableKey", { baseUrl: base });
    expect(client.getUrl("/path").toString()).toBe(expected);
  },
);

test.each(cases)("url construction with `path`: %s -> %s", (base, expected) => {
  const client = new HttpClient("publishableKey", { baseUrl: base });
  expect(client.getUrl("path").toString()).toBe(expected);
});
