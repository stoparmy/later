module.exports = {
  branches: ["main", { name: "beta", prerelease: true }],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/exec", {
      publishCmd: "node scripts/release-docker.mjs ${nextRelease.version} ${nextRelease.channel || ''}",
    }],
    "@semantic-release/github",
  ],
};
