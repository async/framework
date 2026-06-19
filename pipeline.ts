import { definePipeline, env, job, sh, task, trigger } from "@async/pipeline";

const packagePath = "./dist";

export default definePipeline({
  name: "async-framework",
  cache: "file:local",

  triggers: {
    pr: trigger.github({ events: ["pull_request"] }),
    main: trigger.github({ events: ["push"], branches: ["main"] }),
    release: trigger.github({ events: ["release"], types: ["published"] }),
    manual: trigger.manual()
  },

  sync: {
    github: {
      pages: {
        target: "docs.site",
        triggers: {
          pullRequest: false,
          main: false,
          manual: true
        }
      }
    },
    tasks: {
      prefix: "pipeline",
      runners: ["package"],
      targets: [{ package: "@async/framework" }],
      jobs: ["publish", "release-doctor", "verify"],
      tasks: ["docs.site"],
      scripts: {
        "github:check": "github check",
        "github:generate": "github generate",
        "pages": "run-task docs.site",
        "publish:github:release": "publish github release --package ./dist --registry https://npm.pkg.github.com",
        "publish:npm": "publish npm --package ./dist",
        "release:doctor": "release doctor --package ./dist",
        "release:ensure": "release ensure --package ./dist",
        "release:sync-descriptions": "release sync-descriptions --package ./dist",
        "release:sync-descriptions:check": "release sync-descriptions --package ./dist --check",
        "sync:check": "sync check",
        "sync:generate": "sync generate"
      }
    }
  },

  namedInputs: {
    source: [
      "src/**/*.js",
      "tests/**/*.js",
      "examples/**/*",
      "README.md",
      "CHANGELOG.md",
      "package.json",
      "pipeline.ts",
      "scripts/**/*.js"
    ]
  },

  tasks: {
    "docs.site": task({
      description: "Build the standardized GitHub Pages documentation site.",
      inputs: ["README.md", "CHANGELOG.md", "scripts/build-pages.js"],
      outputs: [".async/pages/**"],
      cache: true,
      run: sh`pnpm run docs:build`
    }),

    test: task({
      inputs: ["source"],
      cache: "file:local",
      run: sh`pnpm test`
    }),

    examples: task({
      description: "Validate static example HTML and JavaScript entrypoints.",
      dependsOn: ["test"],
      inputs: ["source"],
      cache: "file:local",
      run: sh`pnpm run examples:check`
    }),

    "registry-lint": task({
      description: "Detect conflicting Async registry declarations in package source without scanning generated bundles.",
      inputs: ["src/**/*.js", "examples/**/*.js", "scripts/registry-lint.js"],
      outputs: [".async/registry-manifest.json", ".async/registry-lint-cache.json"],
      cache: false,
      run: sh`pnpm run registry:lint`
    }),

    pack: task({
      description: "Prove the package can be packed without consumer build steps.",
      dependsOn: ["examples", "docs.site", "registry-lint"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm run pack:check`
    }),

    "release-ensure": task({
      description: "Create or verify the release tag and GitHub Release before package publishing.",
      dependsOn: ["release-evidence"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline release ensure --package ${packagePath}`
    }),

    "release-evidence": task({
      description: "Verify package-owned bundle and scenario release evidence before release notes are synced.",
      dependsOn: ["pack"],
      inputs: ["source"],
      outputs: [".async/release/evidence.json"],
      cache: false,
      run: sh`pnpm run release:evidence:check`
    }),

    "publish-github": task({
      description: "Publish the stable GitHub Packages mirror before npm publishing.",
      dependsOn: ["release-ensure"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline publish github release --package ${packagePath} --registry https://npm.pkg.github.com`
    }),

    publish: task({
      description: "Publish the verified release to npm after the GitHub Packages mirror, then run release doctor.",
      dependsOn: ["publish-github"],
      inputs: ["source"],
      cache: false,
      run: [
        sh`pnpm async-pipeline publish npm --package ${packagePath}`,
        sh`pnpm async-pipeline release doctor --package ${packagePath}`
      ]
    }),

    "release-doctor": task({
      description: "Diagnose release consistency for the current version.",
      dependsOn: ["pack"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline release doctor --package ${packagePath}`
    })
  },

  jobs: {
    verify: job({
      target: "pack",
      trigger: ["pr", "main", "release", "manual"]
    }),

    publish: job({
      target: "publish",
      trigger: ["manual", "release"],
      environment: {
        name: "npm-publish",
        url: "https://www.npmjs.com/package/@async/framework"
      },
      requires: {
        provenance: true
      },
      env: {
        NODE_AUTH_TOKEN: env.secret("npm_token"),
        GITHUB_TOKEN: env.secret("GITHUB_TOKEN")
      },
      github: {
        permissions: {
          contents: "write",
          packages: "write"
        }
      }
    }),

    "release-doctor": job({
      description: "Diagnose release consistency for the current version.",
      target: "release-doctor",
      trigger: ["manual"],
      env: {
        GITHUB_TOKEN: env.secret("GITHUB_TOKEN")
      },
      github: {
        permissions: {
          contents: "read",
          packages: "read"
        }
      }
    })
  }
});
