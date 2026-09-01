const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(extensionRoot, "..");
const packageScript = path.join(extensionRoot, "package-extension.sh");
const packagePath = path.join(projectRoot, "dify-log-browser-extension-v0.1.0.zip");

test("打包脚本明确包含根清单并排除测试与开发文档", () => {
  assert.equal(fs.existsSync(packageScript), true, "package-extension.sh 应存在");
  const source = fs.readFileSync(packageScript, "utf8");

  assert.match(source, /manifest\.json/);
  assert.match(source, /-x[^\n]*tests/);
  assert.match(source, /CONTEXT\.md/);
  assert.doesNotMatch(source, /\.env/);
});

test("实际 ZIP 在根目录包含 manifest，且不包含 tests 和开发文档", () => {
  assert.equal(fs.existsSync(packageScript), true, "package-extension.sh 应存在");
  childProcess.execFileSync("sh", [packageScript], {
    cwd: projectRoot,
    stdio: "pipe"
  });
  assert.equal(fs.existsSync(packagePath), true, "版本化 ZIP 应生成在项目根目录");

  const entries = childProcess
    .execFileSync("unzip", ["-Z1", packagePath], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

  assert.equal(entries.includes("manifest.json"), true);
  assert.equal(entries.some((entry) => entry.startsWith("dify-log-browser-extension/")), false);
  assert.equal(entries.some((entry) => entry.startsWith("tests/")), false);
  assert.equal(entries.includes("CONTEXT.md"), false);
  assert.equal(entries.includes("package-extension.sh"), false);
});
