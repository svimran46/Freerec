import { runPdfOp } from "@/lib/pdf/client";
import { defineTool } from "@/tools/types";
import { pdfOutput, readFile } from "@/tools/client/shared";

export const mergePdf = defineTool<null>({
  initialOptions: () => null,
  blocker: (files) => (files.length < 2 ? "Add at least two PDFs. Drag them into the order you want." : null),
  async process(files, _options, { signal }) {
    const inputs = await Promise.all(files.map(({ file }) => readFile(file)));
    return [pdfOutput("merged.pdf", await runPdfOp("mergePdfs", [inputs], signal))];
  },
});
