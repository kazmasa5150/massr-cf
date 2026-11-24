// 元の spec/models/like_spec.rb の移植。
// 移植版では Like は独立した実体ではなく、発言のハッシュ化の際に
// likes 配列の要素として {id, user} の形で現れる。
import { describe, it, expect } from "vitest";
import {
  addLike,
  createStatement,
  createUser,
  getStatementById,
  statementToHash,
} from "../src/models";
import { createInput, db } from "./helpers";

describe("イイネのハッシュ（元の Like#to_hash）", () => {
  it("id は文字列、user はユーザのハッシュ", async () => {
    const user = await createUser(db(), createInput(0));
    const created = await createStatement(db(), {
      userId: user.id,
      body: "x",
      stampUrl: null,
      resId: null,
      photos: [],
    });
    await addLike(db(), created!.row.id, user.id);
    const stmt = await getStatementById(db(), created!.row.id);
    const hash = statementToHash(stmt!);
    expect(hash.likes.length).toBe(1);
    expect(typeof hash.likes[0].id).toBe("string");
    expect(typeof hash.likes[0].user).toBe("object");
    expect(hash.likes[0].user.massr_id).toBe(user.massr_id);
  });
});
