import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { formatDateTime, marshal, unmarshal, unmarshalDocument } from "../dist/tmark.js";

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

for (const timezone of ["", "UTC", "Europe/Moscow", "Etc/GMT+3", "+02:30", "UTC-3:30", "Z", "GMT", "Future/City", "Local"]) {
  const datetime = { kind: "datetime", unix: 1700000000, timezone };
  assert.deepEqual(unmarshal(marshal(datetime)), datetime);
}
assert.deepEqual(unmarshal("{datetime;1700000000}"), { kind: "datetime", unix: 1700000000, timezone: "" });
assert.equal(unmarshal("{datetime;#timezone{}1700000000}").timezone, "");

for (const unix of [1704063600, 1719790200]) {
  const date = new Date(unix * 1000);
  for (const [timezone, minutes] of [
    ["", 0], ["UTC", 0], ["GMT", 0], ["Z", 0], ["-00:00", 0],
    ["+02:00", 120], ["-03:00", -180], ["+05:45", 345], ["-03:30", -210],
    ["UTC+2", 120], ["UTC-3:30", -210], ["UTC+02:30", 150],
    ["+23:59", 1439], ["-23:59", -1439], ["UTC+23:59", 1439], ["UTC-23:59", -1439],
    ["UTC+00", 0], ["UTC-0:00", 0],
  ]) {
    assert.equal(formatDateTime(date, timezone), new Date(date.getTime() + minutes * 60_000).toLocaleString(undefined, { timeZone: "UTC" }), timezone);
  }
  for (const timezone of [
    "Europe/Moscow", "America/New_York", "US/Eastern", "Etc/GMT+3",
    "CET", "Cuba", "EET", "EST", "Eire", "GB", "HST", "Iran", "MET", "MST", "NZ", "PRC", "ROC", "ROK", "UCT", "WET", "Zulu",
    "Universal", "GMT0", "W-SU",
  ]) {
    assert.equal(formatDateTime(date, timezone), date.toLocaleString(undefined, { timeZone: timezone }), timezone);
  }
}

for (const timezone of [
  "+2:00", "+0200", "+02", "-2", "+24:00", "-00:60", "UTC+24", "UTC-24:00",
  "UTC+2:3", "UTC+2:300", "UTC+002", "UTC+0230", "UTC+", "UTC2", "UTC+2.5",
  "GMT+2", "GMT+03:00", "gmt+2", "utc+2", "utc", "gmt", "z", "Z+2", "UTC−2",
  " UTC", "UTC ", "UTC\n", "+02:00\n", "Europe/Moscow\n", "UTC+２", "Local", "localtime", "posixrules",
  "posix/Europe/Moscow", "right/Europe/Moscow", "/usr/share/zoneinfo/Europe/Moscow", "../Europe/Moscow",
  "EST5EDT,M3.2.0,M11.1.0", "Future/City",
  "PST", "CST", "IST", "MSK", "pst", "cst", "ist", "msk", "PDT", "CDT", "BST", "JST",
]) {
  assert.throws(() => formatDateTime(new Date(0), timezone), RangeError, timezone);
}

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
