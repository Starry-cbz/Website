import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Exercise the exact pure helpers shipped to Mintlify without a JSX runtime.
const source = await readFile(new URL("../snippets/Downloads.jsx", import.meta.url), "utf8");
const helpers = source.split("// UI rendering")[0].replaceAll("export const ", "const ");
const context = vm.createContext({ URL });
vm.runInContext(`${helpers}\nglobalThis.helpers = { releaseSections, selectKiteMarketAssets, localizedReleaseBody, safeWebLink, selectSingleAsset, downloadUrl, normalizeReleases, splitReleaseTableRow, releaseNoteBlocks };`, context);
const h = context.helpers;
const release = (tag, prerelease = false, draft = false, assets = []) => ({
  tag_name: tag, name: tag, prerelease, draft, assets,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

const mixed = h.releaseSections([release("v2.1.0-beta", true), release("v2.0.0"), release("v1.0.0"), release("v3.0.0", false, true)]);
assert.equal(mixed.stable.tag_name, "v2.0.0");
assert.equal(mixed.preview.tag_name, "v2.1.0-beta");
assert.deepEqual(plain(mixed.history.map((item) => item.tag_name)), ["v1.0.0"]);
const previewOnly = h.releaseSections([release("v1.0.0-beta", true)]);
assert.equal(previewOnly.stable, null);
assert.equal(previewOnly.preview.tag_name, "v1.0.0-beta");
assert.equal(previewOnly.history.length, 0);
assert.deepEqual(plain(h.releaseSections([])), { stable: null, preview: null, history: [] });

const names = [
  ...["legacy", "modern", "current"].map((id) => `KiteMarket-${id}-1.0.0.jar`),
  ...["API", "UI-API"].flatMap((id) => ["", "-sources", "-javadoc"].map((suffix) => `KiteMarket-${id}-1.0.0${suffix}.jar`)),
  "KiteMarket-Examples-1.0.0.zip", "KiteMarket-config-zh_CN-1.0.0.zip", "KiteMarket-config-en_US-1.0.0.zip", "SHA256SUMS.txt",
];
const files = names.reverse().map((name) => ({ name }));
const selected = h.selectKiteMarketAssets(release("v1.0.0", false, false, files));
assert.equal(selected.runtime[1].asset.name, "KiteMarket-modern-1.0.0.jar");
assert.equal(selected.sdks[0].sources.name, "KiteMarket-API-1.0.0-sources.jar");
assert.equal(selected.extras.length, 4);
assert.equal(selected.runtime.length + selected.sdks.length * 3 + selected.extras.length, 13);
assert.equal(h.selectKiteMarketAssets(release("v1.0.0", false, false, [{ name: "KiteMarket-API-1.0.0.jar" }])).runtime[1].asset, null);
assert.equal(h.selectKiteMarketAssets(release("latest", false, false, files)), null);
assert.equal(h.selectSingleAsset(release("v1", false, false, [{ name: "verifymc-proxy.jar" }, { name: "VerifyMC.jar" }])).name, "VerifyMC.jar");

const body = "# v1.0.0\n\n### 中文说明\n中文内容\n\n### English\nEnglish content";
assert.equal(h.localizedReleaseBody(body, "zh"), "# v1.0.0\n\n中文内容");
assert.equal(h.localizedReleaseBody(body, "en"), "# v1.0.0\n\nEnglish content");
assert.equal(h.localizedReleaseBody("Legacy notes", "zh"), "Legacy notes");
assert.equal(h.safeWebLink("javascript:alert(1)"), null);
assert.equal(h.safeWebLink("data:text/html,<script>"), null);
assert.equal(h.safeWebLink("https://user:secret@example.com"), null);
assert.equal(h.downloadUrl("https://github.com/KiteMC/ArcPass/releases/download/v1/ArcPass.jar", "mirror", "single"), "https://v4.gh-proxy.org/https://github.com/KiteMC/ArcPass/releases/download/v1/ArcPass.jar");
assert.equal(h.downloadUrl("https://github.com/KiteMC/KiteMarket/releases/download/v1/KiteMarket.jar", "mirror", "kitemarket"), "https://github.com/KiteMC/KiteMarket/releases/download/v1/KiteMarket.jar");
assert.equal(h.downloadUrl("https://github.com.attacker.invalid/plugin.jar", "github", "single"), null);
const normalized = h.normalizeReleases([{
  ...release("v1.0.0"), html_url: "javascript:alert(1)",
  assets: [
    { name: "valid.jar", size: 42, browser_download_url: "https://github.com/KiteMC/KiteMarket/releases/download/v1.0.0/valid.jar" },
    { name: "evil.jar", size: 42, browser_download_url: "https://evil.invalid/plugin.jar" },
  ],
}], "KiteMC", "KiteMarket");
assert.equal(normalized[0].assets.length, 1);
assert.equal(normalized[0].html_url, "https://github.com/KiteMC/KiteMarket/releases/tag/v1.0.0");
assert.throws(() => h.normalizeReleases({}, "KiteMC", "KiteMarket"), /Invalid/);
const runtimeTable = [
  "| 运行包 | Minecraft 范围 | 字节码 |",
  "| --- | --- | --- |",
  "| Legacy | 1.16.5–1.20.4 | Java 11 |",
  "| Modern | 1.20.5–1.21.11 | Java 21 |",
  "| Current | 26.2 | Java 25 |",
].join("\n");
const runtimeBlocks = plain(h.releaseNoteBlocks(runtimeTable));
assert.equal(runtimeBlocks[0].type, "table", "Release runtime tables must render as a table, not raw pipe text");
assert.deepEqual(runtimeBlocks[0].headers, ["运行包", "Minecraft 范围", "字节码"]);
assert.deepEqual(runtimeBlocks[0].rows, [
  ["Legacy", "1.16.5–1.20.4", "Java 11"],
  ["Modern", "1.20.5–1.21.11", "Java 21"],
  ["Current", "26.2", "Java 25"],
]);
assert.equal(runtimeBlocks.length, 1);
assert.deepEqual(plain(h.splitReleaseTableRow("  | `a\\|b` |  **Safe**  |  ")), ["`a|b`", "**Safe**"]);
assert.equal(h.splitReleaseTableRow("An escaped \\| is not a table row"), null);
const borderless = plain(h.releaseNoteBlocks("First | Middle | Last\n:--- | :---: | ---:\nA | B | C\nOnly | two\nOne | two | three | ignored"));
assert.deepEqual(borderless[0].headers, ["First", "Middle", "Last"]);
assert.deepEqual(borderless[0].alignments, ["left", "center", "right"]);
assert.deepEqual(borderless[0].rows, [["A", "B", "C"], ["Only", "two", ""], ["One", "two", "three"]]);
for (const delimiter of ["| --- | nope | --- |", "| -- | --- | --- |", "| --- | --- |"]) {
  assert.ok(!h.releaseNoteBlocks(`| A | B | C |\n${delimiter}\n| X | Y | Z |`).some((block) => block.type === "table"));
}
for (const fence of ["```", "~~~~"]) {
  const blocks = plain(h.releaseNoteBlocks(`${fence}md\n${runtimeTable}\n${fence}`));
  assert.deepEqual(blocks, [{ type: "code", text: runtimeTable }], "Fenced pipe text must stay code");
}
const listBlocks = plain(h.releaseNoteBlocks("- A | B\n- --- | ---\n- X | Y"));
assert.deepEqual(listBlocks, [{ type: "list", items: ["A | B", "--- | ---", "X | Y"] }]);
const mixedBlocks = plain(h.releaseNoteBlocks(`# Notes\n\n- Changed\n\n${runtimeTable}\n\nText\n\`\`\`js\n| code |\n\`\`\``));
assert.deepEqual(mixedBlocks.map((block) => block.type), ["heading", "list", "table", "text", "code"]);
const unsafeCell = "<script>alert(1)</script> [bad](javascript:alert(1))";
const unsafeTable = plain(h.releaseNoteBlocks(`| Value | Other |\n| --- | --- |\n| ${unsafeCell} | <img src=x onerror=alert(1)> |`));
assert.equal(unsafeTable[0].rows[0][0], unsafeCell, "Parser preserves raw text for React escaping, never interprets HTML");
assert.ok(!source.includes("dangerouslySetInnerHTML"));
assert.ok(!source.includes("Authorization"));
// Mintlify compiles only parent-imported exports; helpers in the same JSX file
// are not automatically made available in a component's evaluated scope.
const expectedImports = ["Downloads", ...Object.keys(h)];
for (const page of [
  "arcpass/download.mdx", "en/arcpass/download.mdx",
  "kitemarket/download.mdx", "en/kitemarket/download.mdx",
  "archive/verifymc/download.mdx", "en/archive/verifymc/download.mdx",
]) {
  const text = await readFile(new URL(`../${page}`, import.meta.url), "utf8");
  const imports = /import\s*\{([^}]+)\}\s*from\s*["']\/snippets\/Downloads\.jsx["']/.exec(text);
  assert.ok(imports, `${page}: missing download snippet import`);
  const names = new Set(imports[1].split(",").map((name) => name.trim()).filter(Boolean));
  for (const name of expectedImports) assert.ok(names.has(name), `${page}: missing parent import ${name}`);
}
console.log("Download helpers: release sections, 13 exact assets, safe links, GFM tables, escaped pipes, code/list isolation and 6 complete Mintlify imports passed.");
