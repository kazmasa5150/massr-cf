// 元の spec/models/plugin_setting_spec.rb の移植。
// 元の PluginSetting.set/get は (key, value) だが、移植版では
// プラグイン名もキーに含む (plugin, key, value) 形式になっている。
import { describe, it, expect } from "vitest";
import { getPluginSetting, setPluginSetting } from "../src/models";
import { db } from "./helpers";

describe("プラグイン設定（元の PluginSetting）", () => {
  it("保存して読み戻せ、上書きもできる", async () => {
    await setPluginSetting(db(), "test", "aaa", "value1");
    expect(await getPluginSetting(db(), "test", "aaa")).toBe("value1");
    await setPluginSetting(db(), "test", "aaa", "value2");
    expect(await getPluginSetting(db(), "test", "aaa")).toBe("value2");
  });

  it("存在しないキーは null", async () => {
    await setPluginSetting(db(), "test", "aaa", "value1");
    expect(await getPluginSetting(db(), "test", "hoge")).toBeNull();
    expect(await getPluginSetting(db(), "other", "aaa")).toBeNull();
  });
});
