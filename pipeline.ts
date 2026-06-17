import { definePipeline, env, job, sh, task, trigger } from "@async/pipeline";

const packagePath = ".";

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
    github: true,
    tasks: {
      prefix: "pipeline",
      runners: ["package"],
      targets: [{ package: "@async/framework" }],
      jobs: ["pages", "publish", "release-doctor", "verify"],
      tasks: ["docs.site"],
      scripts: {
        "github:check": "github check",
        "github:generate": "github generate",
        "publish:npm": "publish npm --package .",
        "release:doctor": "release doctor --package .",
        "release:ensure": "release ensure --package .",
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
      "framework.js",
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
      run: sh`node --test tests/*.test.js`
    }),

    examples: task({
      description: "Validate static example HTML and JavaScript entrypoints.",
      dependsOn: ["test"],
      inputs: ["source"],
      cache: "file:local",
      run: sh`pnpm run examples:check`
    }),

    pack: task({
      description: "Prove the package can be packed without consumer build steps.",
      dependsOn: ["examples", "docs.site"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm run bundle:check && npm pack --dry-run --ignore-scripts`
    }),

    "release-ensure": task({
      description: "Create or verify the release tag and GitHub Release before package publishing.",
      dependsOn: ["pack"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline release ensure --package ${packagePath}`
    }),

    publish: task({
      description: "Publish the verified release to npm, then run release doctor.",
      dependsOn: ["release-ensure"],
      inputs: ["source"],
      cache: false,
      run: [
        sh`pnpm async-pipeline publish npm --package ${packagePath}`,
        sh`node scripts/release-doctor.js`
      ]
    }),

    "release-doctor": task({
      description: "Diagnose release consistency for the current version.",
      dependsOn: ["pack"],
      inputs: ["source"],
      cache: false,
      run: sh`node scripts/release-doctor.js`
    })
  },

  jobs: {
    verify: job({
      target: "pack",
      trigger: ["pr", "main", "release", "manual"]
    }),

    pages: job({
      target: "docs.site",
      trigger: ["manual"],
      github: {
        pages: {
          build: { kind: "static", path: ".async/pages" }
        }
      }
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
