import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Processor } from "@/tools/processors";
import { getTool } from "@/tools/registry";
import { ToolWorkspace } from "./ToolWorkspace";

const mergePdf = getTool("merge-pdf")!;
const pdf = (name: string) => new File(["%PDF-1.7\n"], name, { type: "application/pdf" });

afterEach(cleanup);

describe("ToolWorkspace", () => {
  it("shows a roadmap notice for tools without a processor", () => {
    render(<ToolWorkspace tool={mergePdf} />);
    expect(screen.getByText(/arrives in phase 1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeTruthy();
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
    const processor = vi.fn<Processor>(async () => [
      { name: "merged.pdf", data: new Blob(["%PDF"]) },
      { name: "extra.pdf", data: new Blob(["%PDF"]) },
    ]);
    render(<ToolWorkspace tool={mergePdf} processor={processor} />);

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
    const processor = vi.fn<Processor>(async () => {
      throw new Error("Encrypted PDFs are not supported.");
    });
    render(<ToolWorkspace tool={mergePdf} processor={processor} />);
    await user.upload(screen.getByTestId("file-input"), [pdf("a.pdf")]);
    const run = screen.getByRole("button", { name: "Merge PDF" });
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    await user.click(run);
    expect((await screen.findByRole("alert")).textContent).toBe("Encrypted PDFs are not supported.");
  });
});
