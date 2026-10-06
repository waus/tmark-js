import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { marshal, unmarshal, unmarshalDocument } from "../dist/tmark.js";

function fixtureFiles(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => join(dir, name));
}

const document = unmarshalDocument("{document;#url{https://example.org}#title{Hello}{p;Hello}}");
assert.equal(document.kind, "document");
assert.deepEqual(unmarshalDocument(marshal(document)), document);
assert.deepEqual(unmarshal(marshal(unmarshal("{p;Hello}"))), unmarshal("{p;Hello}"));
assert.throws(() => unmarshalDocument("{p;Hello}"));

const video = unmarshal("{video;#preview{https://example.org/preview.jpg}#loop{t}https://example.org/video.mp4}");
assert.deepEqual(video, { kind: "video", src: "https://example.org/video.mp4", caption: undefined, hasSpoiler: false, preview: "https://example.org/preview.jpg", loop: true });
assert.equal(marshal(video), "{video;#preview{https://example.org/preview.jpg}#loop{t}https://example.org/video.mp4}");
assert.equal(unmarshal("{video;clip.mp4}").loop, false);
assert.throws(() => unmarshal("{video;#loop{yes}clip.mp4}"));

for (const file of fixtureFiles("../fixtures/valid", ".tmark")) {
  const source = readFileSync(file, "utf8");
  assert.equal(marshal(unmarshalDocument(source, { soft: true })), source, basename(file));
}

for (const file of fixtureFiles("../fixtures/valid", ".fixture")) {
  const source = readFileSync(file, "utf8");
  assert.equal(marshal(unmarshal(source)), source, basename(file));
}

for (const file of fixtureFiles("../fixtures/invalid", ".tmark")) {
  const source = readFileSync(file, "utf8");
  assert.throws(() => unmarshalDocument(source), undefined, basename(file));
}
