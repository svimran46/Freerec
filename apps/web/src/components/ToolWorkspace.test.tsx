import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutputFile } from "@/lib/download";
import type { AcceptedFile } from "@/lib/validate-files";
import { getTool } from "@/tools/registry";
import { defineTool, type RunContext } from "@/tools/types";
import { ToolWorkspace } from "./ToolWorkspace";

const mergePdf = getTool("merge-pdf")!;
const pdf = (name: string) => new File(["%PDF-1.7\n"], name, { type: "application/pdf" });

type Process = (files: readonly AcceptedFile[], options: unknown, context: RunContext) => Promise<OutputFile[]>;
const withProcess = (process: Process) => defineTool<null>({ initialOptions: () => null, process });

afterEach(cleanup);

describe("ToolWorkspace", () => {
  it("shows a roadmap notice for tools without an implementation", () => {
    render(<ToolWorkspace tool={getTool("compress-pdf")!} />);
    expect(screen.getByText(/arrives in phase 3/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose a file" })).toBeTruthy();
  });

  it("lists accepted files and reports rejected ones", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ToolWorkspace tool={mergePdf} />);
    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf"), new File(["hi"], "b.pdf")]);

    expect(await screen.findByRole("list", { name: "Selected files" })).toBeTruthy();
    expect(screen.getByText("a.pdf")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("b.pdf");

    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    expect(screen.queryByRole("list", { name: "Selected files" })).toBeNull();
  });

  it("runs the processor and offers the outputs for download", async () => {
    const user = userEvent.setup();
    const processor = vi.fn<Process>(async () => [
      { name: "merged.pdf", data: new Blob(["%PDF"]) },
      { name: "extra.pdf", data: new Blob(["%PDF"]) },
    ]);
    render(<ToolWorkspace tool={mergePdf} implementation={withProcess(processor)} />);

    const run = screen.getByRole("button", { name: "Merge PDF" });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf"), pdf("b.pdf")]);
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    await user.click(run);

    expect(await screen.findByRole("region", { name: "Results" })).toBeTruthy();
    expect(processor).toHaveBeenCalledOnce();
    expect(processor.mock.calls[0][0]).toHaveLength(2);
    expect(screen.getByText("merged.pdf")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download all as ZIP" })).toBeTruthy();
  });

  it("shows processor errors", async () => {
    const user = userEvent.setup();
    const processor = vi.fn<Process>(async () => {
      throw new Error("Encrypted PDFs are not supported.");
    });
    render(<ToolWorkspace tool={mergePdf} implementation={withProcess(processor)} />);
    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf")]);
    const run = screen.getByRole("button", { name: "Merge PDF" });
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    await user.click(run);
    expect((await screen.findByRole("alert")).textContent).toBe("Encrypted PDFs are not supported.");
  });

  it("lets files be reordered before running", async () => {
    const user = userEvent.setup();
    const processor = vi.fn<Process>(async () => []);
    render(<ToolWorkspace tool={mergePdf} implementation={withProcess(processor)} />);
    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]);
    await user.click(await screen.findByRole("button", { name: "Move c.pdf up" }));
    await user.click(screen.getByRole("button", { name: "Move a.pdf down" }));
    await user.click(screen.getByRole("button", { name: "Merge PDF" }));

    await screen.findByRole("region", { name: "Results" });
    expect(processor.mock.calls[0][0].map((f) => f.file.name)).toEqual(["c.pdf", "a.pdf", "b.pdf"]);
  });

  it("shows settings, explains what blocks a run, and passes the settings on", async () => {
    const user = userEvent.setup();
    const process = vi.fn<Process>(async () => []);
    const implementation = defineTool<{ name: string }>({
      initialOptions: () => ({ name: "" }),
      Options: ({ options, setOptions }) => (
        <input
          aria-label="Name"
          value={options.name}
          onChange={(event) => setOptions((o) => ({ ...o, name: event.target.value }))}
        />
      ),
      blocker: (_files, options) => (options.name ? null : "Enter a name."),
      process: (files, options, context) => process(files, options, context),
    });
    render(<ToolWorkspace tool={mergePdf} implementation={implementation} />);
    expect(screen.queryByRole("region", { name: "Settings" })).toBeNull();

    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf")]);
    const run = screen.getByRole("button", { name: "Merge PDF" }) as HTMLButtonElement;
    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(run.disabled).toBe(true);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    expect(screen.queryByText("Enter a name.")).toBeNull();
    await user.click(run);
    await screen.findByRole("region", { name: "Results" });
    expect(process.mock.calls[0][1]).toEqual({ name: "x" });
  });

  it("reports progress and can be cancelled", async () => {
    const user = userEvent.setup();
    const implementation = withProcess(
      (_files, _options, { signal, onProgress }) =>
        new Promise((_resolve, reject) => {
          onProgress({ done: 2, total: 5, unit: "pages" });
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    render(<ToolWorkspace tool={mergePdf} implementation={implementation} />);
    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf")]);
    const run = screen.getByRole("button", { name: "Merge PDF" }) as HTMLButtonElement;
    await waitFor(() => expect(run.disabled).toBe(false));
    await user.click(run);

    expect((await screen.findByRole("status")).textContent).toBe("2 of 5 pages");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Merge PDF" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
