import assert from "node:assert/strict";
import { test } from "node:test";
import { urlBase64ToBytes } from "./base64.ts";

test("urlBase64ToBytes decodes base64url without padding", () => {
  // "-_6-" is the URL-safe form of "+/6+"
  assert.deepEqual([...urlBase64ToBytes("-_6-")], [251, 254, 190]);
  assert.deepEqual([...urlBase64ToBytes("AQID")], [1, 2, 3]);
  assert.deepEqual([...urlBase64ToBytes("AQI")], [1, 2]);
});

test("urlBase64ToBytes handles a 65-byte public key", () => {
  const key = "BFFcPW6545a5BNP-yn9U_c0MwemXvzddylFa0KbDtANfRTa-OlDzGPv5pUdZAqIhUCvvDVfgjFOyzApW8X2fk1Q";
  const bytes = urlBase64ToBytes(key);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4); // uncompressed point marker
});
