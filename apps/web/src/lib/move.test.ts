import { describe, expect, it } from "vitest";
import { moveItem } from "./move";

describe("moveItem", () => {
  it("moves an item and leaves the input alone", () => {
    const items = ["a", "b", "c", "d"];
    expect(moveItem(items, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(items, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores positions outside the list", () => {
    expect(moveItem(["a", "b"], 0, 2)).toEqual(["a", "b"]);
  });
});
