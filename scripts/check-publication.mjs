import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, lstatSync } from "node:fs";

const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))];
const localValues = [];
for (const name of readdirSync(".")) {
  if (!name.startsWith(".env") || name === ".env.example" || !lstatSync(name).isFile()) continue;
  for (const line of readFileSync(name, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$/);
    if (!match || !/(TOKEN|PASSWORD|SECRET|KEY|DATABASE_URL)$/.test(match[1])) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value.length >= 12) localValues.push(value);
  }
}
const forbiddenPath = /(?:^|\/)(?:\.env(?:\..*)?|[^/]+\.env|\.npmrc|\.netrc|\.aws|\.ssh|\.playwright-cli|playwright-report|test-results|output)(?:\/|$)|\.(?:sql|dump|sqlite\w*|db|pem|key|p12|pfx|har|bak|backup|zip|tar(?:\.gz)?)$/i;
const privateFiles = new Set(["compose.local.yml", "scripts/setup-local-chatwoot.rb", "examples/nginx/local-chatwoot.conf"]);
const signatures = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
];
const failures = [];
for (const file of files) {
  if ((file !== ".env.example" && forbiddenPath.test(file)) || privateFiles.has(file)) failures.push(`${file}: private file type`);
  if (!lstatSync(file).isFile()) { failures.push(`${file}: non-regular file requires review`); continue; }
  const content = readFileSync(file, "utf8");
  if (content.includes("\0")) failures.push(`${file}: binary file requires review`);
  if (signatures.some(pattern => pattern.test(content))) failures.push(`${file}: credential signature`);
  if (localValues.some(value => content.includes(value))) failures.push(`${file}: local credential value`);
  if (/\/Users\/|hd\.stoparmy\.org\.test|stoparmyorg[_]local|E2E-\d{10,}/.test(content)) failures.push(`${file}: private workstation or test data`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Publication check passed: ${files.length} files; no matching secrets, private setup, or captured data.`);
}
