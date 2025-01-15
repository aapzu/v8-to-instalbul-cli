import yargs from "yargs";
import v8toIstanbul from "v8-to-istanbul";
import libCoverage from "istanbul-lib-coverage";
import { z } from "zod";
import globToRegex from "glob-to-regexp";

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
            })
          ),
        })
      ),
    })
  ),
});

const { coveragePath, output, exclude } = yargs(Deno.args)
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

const coverageJsonFiles = [];

if ((await Deno.stat(coveragePath)).isDirectory) {
  for await (const file of Deno.readDir(coveragePath)) {
    if (file.name.startsWith("coverage") && file.name.endsWith(".json")) {
      coverageJsonFiles.push(`${coveragePath}/${file.name}`);
    }
  }
} else {
  coverageJsonFiles.push(coveragePath);
}

const coverages = await Promise.all(
  coverageJsonFiles.map(async (filePath) => {
    const coverageJsonUintArray = await Deno.readFile(filePath);
    return v8CoverageJsonSchema.parse(
      JSON.parse(new TextDecoder().decode(coverageJsonUintArray))
    );
  })
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
        !exclude.some((pattern) => globToRegex(pattern).test(filePath))
    )
    .map(async ({ filePath, result }) => {
      const converter = v8toIstanbul(filePath);
      try {
        await converter.load();
        converter.applyCoverage(result.functions);
        map.merge(converter.toIstanbul());
      } catch (error) {
        console.error(
          `Error processing ${filePath}: ${(error as Error)?.message}`
        );
      }
    })
);

const coverageSummary = map.getCoverageSummary();
console.info(coverageSummary);

const outputString = JSON.stringify(map, null, 2);

if (output) {
  fs.writeFileSync(output, outputString);
} else {
  console.info(
    "No output file specified. Use the --output option to specify an output file."
  );
}
