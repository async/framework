import { definePipeline, job, sh, task, trigger } from "@async/pipeline";

export default definePipeline({
  name: "async-framework",
  cache: "file:local",

  triggers: {
    pr: trigger.github({ events: ["pull_request"] }),
    main: trigger.github({ events: ["push"], branches: ["main"] }),
    manual: trigger.manual()
  },

  sync: {
    github: true,
    tasks: true
  },

  namedInputs: {
    source: [
      "src/**/*.js",
      "tests/**/*.js",
      "examples/**/*",
      "package.json",
      "pipeline.ts"
    ]
  },

  tasks: {
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
      dependsOn: ["examples"],
      inputs: ["source"],
      cache: false,
      run: sh`npm pack --dry-run --ignore-scripts`
    })
  },

  jobs: {
    verify: job({
      target: "pack",
      trigger: ["pr", "main", "manual"]
    })
  }
});
