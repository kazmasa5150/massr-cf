// 元の spec/models/search_pin_spec.rb の移植。
import { describe, it, expect } from "vitest";
import {
  createSearchPin,
  listSearchPins,
  updateSearchPinLabel,
} from "../src/models";
import { db } from "./helpers";

describe("createSearchPin（元の create_by_word）", () => {
  it("label 省略時は word と同じ label になる", async () => {
    const pin = await createSearchPin(db(), "aaa", null);
    expect(pin?.word).toBe("aaa");
    expect(pin?.label).toBe("aaa");
  });

  it("同じ word は重複して作れない", async () => {
    await createSearchPin(db(), "aaa", null);
    const dup = await createSearchPin(db(), "aaa", null);
    expect(dup).toBeNull();
    const pins = await listSearchPins(db());
    expect(pins.length).toBe(1);
  });
});

describe("updateSearchPinLabel（元の label=）", () => {
  it("label だけが変わり word は変わらない", async () => {
    await createSearchPin(db(), "aaa", null);
    const updated = await updateSearchPinLabel(db(), "aaa", "bbb");
    expect(updated?.word).toBe("aaa");
    expect(updated?.label).toBe("bbb");
    const pins = await listSearchPins(db());
    expect(pins[0].label).toBe("bbb");
  });

  it("存在しない word では null が返る", async () => {
    const updated = await updateSearchPinLabel(db(), "hoge", "bbb");
    expect(updated).toBeNull();
  });
});
