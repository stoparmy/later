import { execFileSync } from "node:child_process";

const [version, channel = ""] = process.argv.slice(2);
if (!version) throw new Error("release version is required");

const repository = process.env.GITHUB_REPOSITORY?.toLowerCase();
if (!repository) throw new Error("GITHUB_REPOSITORY is required");

const image = `ghcr.io/${repository}`;
const tags = [`${image}:${version}`];
if (channel === "beta") {
  tags.push(`${image}:beta`);
} else {
  const [major, minor] = version.split(".");
  tags.push(`${image}:latest`, `${image}:${major}`, `${image}:${major}.${minor}`);
}

const args = ["buildx", "build", "--push", "--platform", process.env.DOCKER_PLATFORMS || "linux/amd64"];
args.push("--label", `org.opencontainers.image.source=https://github.com/${repository}`);
args.push("--label", `org.opencontainers.image.version=${version}`);
args.push("--label", "org.opencontainers.image.licenses=MIT");
if (process.env.GITHUB_SHA) args.push("--label", `org.opencontainers.image.revision=${process.env.GITHUB_SHA}`);
for (const tag of tags) args.push("--tag", tag);
args.push(".");
execFileSync("docker", args, { stdio: "inherit" });
