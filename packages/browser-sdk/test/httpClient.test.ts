import { HttpClient } from "../src/httpClient";

const cases = [
  ["https://front.bucket.co", "https://front.bucket.co/path"],
  ["https://front.bucket.co/", "https://front.bucket.co/path"],
  ["https://front.bucket.co/basepath", "https://front.bucket.co/basepath/path"],
];

test.each(cases)("handles base url: %s -> %s", (base, expected) => {
  const client = new HttpClient("publishableKey", base);
  expect(client.getUrl("path").toString()).toBe(expected);
});
