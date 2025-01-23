import v8toIstanbul from "npm:v8-to-istanbul";
// @ts-types="npm:@types/istanbul-lib-coverage"
import libCoverage from "npm:istanbul-lib-coverage";
import globToRegex from "npm:glob-to-regexp";
import { z } from "npm:zod";

const v8CoverageJsonSchema = z.object({
  result: z.array(
    z.object({
      url: z.string(),
      functions: z.array(
        z.object({
          functionName: z.string().optional(),
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

export const createCoverageMap = async (
  { coveragePath, exclude }: { coveragePath: string; exclude: string[] },
) => {
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

  return map;
};
