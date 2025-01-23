// @ts-types="npm:@types/istanbul-lib-report"
import libReport from "npm:istanbul-lib-report";
// @ts-types="npm:@types/istanbul-reports"
import reports from "npm:istanbul-reports";
// @ts-types="npm:@types/istanbul-lib-coverage"
import { CoverageMap } from "npm:istanbul-lib-coverage";
import glob from "npm:fast-glob";

const getTempDir = () => Deno.makeTempDirSync();

export const createReport = (
  coverageMap: CoverageMap,
  {
    outputType,
    outputFile,
    outputDir: outputDirParam,
    defaultSummarizer,
  }: {
    outputType: string;
    outputFile?: string;
    outputDir?: string;
    defaultSummarizer?: libReport.Summarizers;
  },
) => {
  if (outputDirParam && outputFile) {
    throw new Error("Cannot specify both outputDir and outputFile");
  }

  const outputDir = outputDirParam ?? getTempDir();

  const context = libReport.createContext({
    dir: outputDir,
    defaultSummarizer,
    coverageMap,
  });

  const report = reports.create(outputType as keyof reports.ReportOptions, {});
  report.execute(context);

  if (outputFile) {
    const outputFiles = glob.sync(`${outputDir}/**`);
    if (outputFiles.length < 1) {
      throw new Error("No files were written to the output directory");
    }
    if (outputFiles.length > 1) {
      throw new Error(
        `Output type ${outputType} cannot be used with 'outputFile' as it produces multiple files. Use 'outputDir' instead.`,
      );
    }
    const [outputFilePath] = outputFiles;
    Deno.copyFileSync(outputFilePath, outputFile);
  }
};
