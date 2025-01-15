import yargs from "npm:yargs";
import v8toIstanbul from "npm:v8-to-istanbul";
import libCoverage from "npm:istanbul-lib-coverage";
import { z } from "npm:zod";
import globToRegex from "npm:glob-to-regexp";
import pkg from "./package.json" with { type: "json" };

const v8CoverageJsonSchema = z.object({
  result: z.array(
    z.object({
      url: z.string(),
      functions: z.array(
        z.object({
          functionName: z.string(),
          isBlockCoverage: z.boolean(),
          ranges: z.array(
            z.object({
              startOffset: z.number(),
              endOffset: z.number(),
              count: z.number(),
            }),
          ),
        }),
      ),
    }),
  ),
});

const { coveragePath, output, exclude } = yargs(Deno.args)
  .scriptName(Object.keys(pkg.bin)[0])
  .option("coveragePath", {
    alias: ["c", "p"],
    describe: "The path to the coverage file or directory",
    type: "string",
    path: true,
    demandOption: true,
  })
  .option("output", {
    alias: "o",
    describe: "The path to the output file",
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
  .help()
  .parseSync();

const map = libCoverage.createCoverageMap();

const coverageJsonFiles = Deno.statSync(coveragePath).isDirectory
  ? Array.from(Deno.readDirSync(coveragePath))
    .filter((file) =>
      file.name.startsWith("coverage") && file.name.endsWith(".json")
    )
    .map((file) => `${coveragePath}/${file.name}`)
  : [coveragePath];

const coverages = coverageJsonFiles.map((filePath) =>
  v8CoverageJsonSchema.parse(
    JSON.parse(new TextDecoder().decode(Deno.readFileSync(filePath))),
  )
);

const fileResults = coverages.flatMap((coverage) =>
  coverage.result.filter(({ url }) => url.startsWith("file://"))
);

await Promise.all(
  fileResults
    .map((result) => ({
      filePath: result.url.replace("file://", ""),
      result,
    }))
    .filter(
      ({ filePath }) =>
        !exclude.some((pattern) => globToRegex(pattern).test(filePath)),
    )
    .map(async ({ filePath, result }) => {
      const converter = v8toIstanbul(filePath);
      try {
        await converter.load();
        converter.applyCoverage(result.functions);
        map.merge(converter.toIstanbul());
      } catch (error) {
        console.error(
          `Error processing ${filePath}: ${(error as Error)?.message}`,
        );
      }
    }),
);

const coverageSummary = map.getCoverageSummary();
console.info(coverageSummary);

const outputString = JSON.stringify(map, null, 2);

if (output) {
  const encoder = new TextEncoder();
  Deno.writeFileSync(output, encoder.encode(outputString));
} else {
  console.info(
    "No output file specified. Use the --output option to specify an output file.",
  );
}
