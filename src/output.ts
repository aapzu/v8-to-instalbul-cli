// @ts-types="npm:@types/istanbul-lib-report"
import libReport from "npm:istanbul-lib-report";
// @ts-types="npm:@types/istanbul-reports"
import reports from "npm:istanbul-reports";
// @ts-types="npm:@types/istanbul-lib-coverage"
import { CoverageMap } from "npm:istanbul-lib-coverage";

export const writeOutput = (
  coverageMap: CoverageMap,
  {
    outputType,
    outputFile,
    outputDir,
    defaultSummarizer,
  }: {
    outputType: string;
    outputFile?: string;
    outputDir?: string;
    defaultSummarizer?: libReport.Summarizers;
  },
) => {
  if (outputType === "json") {
    const outputString = JSON.stringify(coverageMap, null, 2);
    if (outputFile || outputDir) {
      const encoder = new TextEncoder();
      Deno.writeFileSync(
        outputFile || `${outputDir}/coverage-final.json`,
        encoder.encode(outputString),
      );
    } else {
      console.log(outputString);
    }
    return;
  }
  if (outputFile) {
    throw new Error("Output file is only supported for json output");
  }
  if (!outputDir && outputType !== "text-summary" && outputType !== "text") {
    throw new Error(`Output directory is required for ${outputType} output`);
  }

  const context = libReport.createContext({
    dir: outputDir,
    defaultSummarizer,
    coverageMap,
  });

  const report = reports.create(outputType as keyof reports.ReportOptions, {});
  report.execute(context);
};
