// @ts-types="npm:@types/yargs"
import yargs from "npm:yargs";
import pkg from "./package.json" with { type: "json" };
import { createCoverageMap } from "./src/coverage.ts";
import { createReport } from "./src/report.ts";

const {
  coveragePath,
  outputFile,
  outputDir,
  outputType,
  exclude,
} = yargs(Deno.args)
  .scriptName(Object.keys(pkg.bin)[0])
  .option("coverage-path", {
    alias: ["c", "p"],
    describe: "The path to the coverage file or directory",
    type: "string",
    path: true,
    demandOption: true,
  })
  .option("output-file", {
    alias: "o",
    describe: "The path to the output file. Defaults to stdout",
    type: "string",
  })
  .option("output-dir", {
    alias: "d",
    describe: "The directory to output the report to",
    type: "string",
  })
  .option("exclude", {
    alias: "e",
    describe:
      "Exclude a file or directory from coverage. Accepts a glob or a list of globs",
    type: "string",
    array: true,
    default: ["**/node_modules/**"],
  })
  .option("output-type", {
    alias: "t",
    describe: "The output type",
    choices: ["json", "html", "lcov", "lcovonly", "text-summary", "text"],
    default: "json",
  })
  .conflicts("output-file", "output-dir")
  .help()
  .parseSync();

const coverageMap = await createCoverageMap({ coveragePath, exclude });

createReport(coverageMap, {
  outputType,
  outputFile,
  outputDir,
});
