import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/components/BookShelf.tsx", import.meta.url), "utf8");
const runtime = await readFile(new URL("../src/runtime/createBookShelfRuntime.js", import.meta.url), "utf8");

for (const forbidden of ["<iframe", "srcDoc=", "postMessage(", "complete-shelf.document"]) {
  assert.equal(component.includes(forbidden), false, `React component contains forbidden bridge token: ${forbidden}`);
}

for (const forbidden of [
  "MengTo/complete-shelf",
  "COVER_ATLAS_DATA",
  "WOOD_TEXTURE_DATA",
  "data:image/",
  "cdn.jsdelivr.net",
  "document.documentElement",
  "window.innerWidth",
  "window.innerHeight",
]) {
  assert.equal(runtime.includes(forbidden), false, `Runtime contains a non-original or unscoped token: ${forbidden}`);
}

assert.match(runtime, /import \* as THREE from "three"/);
assert.match(runtime, /makeCoverTexture/);
assert.match(runtime, /drawMotif/);
assert.match(runtime, /ResizeObserver/);
assert.match(component, /export const BookShelf/);
assert.match(component, /shelves: resolvedShelves/);
assert.doesNotMatch(component, /shelfLevels/);
assert.doesNotMatch(component, /\bbooks\s*[:?]/);
assert.match(runtime, /const resolvedShelves/);
assert.doesNotMatch(runtime, /getLevelSizes/);

const runtimeRoles = new Set(
  [...runtime.matchAll(/querySelector\('\[data-shelf="([^"]+)"\]'\)/g)].map((match) => match[1]),
);
const componentRoles = new Set(
  [...component.matchAll(/data-shelf="([^"]+)"/g)].map((match) => match[1]),
);

assert.deepEqual(
  [...runtimeRoles].sort(),
  [...componentRoles].sort(),
  "React shell and runtime data-shelf contracts diverged",
);

assert.match(
  component,
  /<header className="editorial-header"[\s\S]*data-shelf="level-counter"[\s\S]*<\/header>/,
  "Shelf-level status must stay in the top editorial header",
);
assert.doesNotMatch(
  component,
  /<nav className="index-nav"[\s\S]*data-shelf="level-counter"[\s\S]*<\/nav>/,
  "Shelf-level status must not compete with the bottom volume controls",
);
assert.match(
  runtime,
  /OPENING_ENVIRONMENT_CLEAR_PROGRESS[\s\S]*environment\.position\.y = THREE\.MathUtils\.lerp\(0, -4\.2, shelfExit\)/,
  "The shelf must move out of view during the detail-opening transition",
);
assert.match(
  runtime,
  /CLOSING_ENVIRONMENT_REVEAL_PROGRESS[\s\S]*environment\.position\.y = THREE\.MathUtils\.lerp\(-4\.2, 0, shelfReturn\)/,
  "The shelf must return along the closing transition",
);
assert.match(runtime, /makeEndpaperTexture/);
assert.match(runtime, /drawReadingPage/);
assert.match(runtime, /getSpreadLabels/);
assert.doesNotMatch(runtime, /readingPivot/);
assert.match(runtime, /const SPREAD_COUNT = 5/);
assert.match(runtime, /BookShelf volume motion/);
assert.match(runtime, /makeContactShadowTexture/);
assert.match(runtime, /has-book-hover/);
assert.match(runtime, /backFill/);
assert.match(runtime, /spineRake/);
assert.match(runtime, /setBookTheme/);
assert.match(runtime, /updateThemeMotion/);
assert.match(runtime, /function getDetailScale/);
assert.match(runtime, /fromScale: volume\.root\.scale\.x/);
assert.match(runtime, /toScale: getDetailScale\(\)/);
assert.match(runtime, /volume\.contactShadow\.visible = false/);
assert.match(runtime, /volume\.contactShadow\.visible = true/);
assert.match(runtime, /const READING_LEAF_COUNT = SPREAD_COUNT - 1/);
assert.match(runtime, /const readingLeaves = \[\]/);
assert.match(runtime, /function getReadingLeafPose/);
assert.match(runtime, /function ensureReadingLeafArt/);
assert.match(runtime, /function beginPageDrag/);
assert.match(runtime, /function commitPageDrag/);
assert.match(
  runtime,
  /if \(progress === 1\) \{[\s\S]*environment\.visible = false;[\s\S]*mode = "detail";/,
  "The shelf environment must leave the render tree when detail orbit begins",
);
assert.match(
  runtime,
  /function close\(\) \{[\s\S]*environment\.visible = true;[\s\S]*mode = "closing";/,
  "The shelf environment must return only for the closing transition",
);

console.log(`Verified original BookShelf runtime and ${runtimeRoles.size} scoped DOM roles.`);
