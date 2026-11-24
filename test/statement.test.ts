// 元の spec/models/statement_spec.rb の移植。
// 元の get_statements の body 正規表現クエリは、移植版では
// 部分一致検索（search）に読み替える。
import { describe, it, expect } from "vitest";
import {
  addLike,
  createStatement,
  createUser,
  getStatementById,
  getStatements,
  statementToHash,
} from "../src/models";
import { createInput, db, prototypeStatement } from "./helpers";

const nowSec = () => Math.floor(Date.now() / 1000);

describe("createStatement（元の update_statement）", () => {
  it("発言が正常に登録できる", async () => {
    const user = await createUser(db(), createInput(0));
    const p = prototypeStatement(0);
    const created = await createStatement(db(), {
      userId: user.id,
      body: p.body,
      stampUrl: null,
      resId: null,
      photos: p.photos,
    });
    expect(created?.row.body).toBe(p.body);
    expect(created?.photos).toEqual(p.photos);
    expect(created?.row.user_id).toBe(user.id);
    expect(created?.res).toBeNull();
  });

  it("レス発言では res に元の発言が入る", async () => {
    const user = await createUser(db(), createInput(1));
    const p0 = prototypeStatement(0);
    const first = await createStatement(db(), {
      userId: user.id,
      body: p0.body,
      stampUrl: null,
      resId: null,
      photos: p0.photos,
    });
    const p1 = prototypeStatement(1);
    const second = await createStatement(db(), {
      userId: user.id,
      body: p1.body,
      stampUrl: null,
      resId: first!.row.id,
      photos: p1.photos,
    });
    expect(second?.row.body).toBe(p1.body);
    expect(second?.row.user_id).toBe(user.id);
    expect(second?.res?.row.id).toBe(first!.row.id);
  });
});

describe("イイネ（元の like?）", () => {
  it("イイネした人が含まれ、していない人は含まれない", async () => {
    const user0 = await createUser(db(), createInput(0));
    const user1 = await createUser(db(), createInput(1));
    const p = prototypeStatement(0);
    const created = await createStatement(db(), {
      userId: user0.id,
      body: p.body,
      stampUrl: null,
      resId: null,
      photos: p.photos,
    });
    await addLike(db(), created!.row.id, user1.id);
    const stmt = await getStatementById(db(), created!.row.id);
    expect(stmt?.likes.length).toBe(1);
    expect(stmt?.likes.some((l) => l.user.massr_id === user1.massr_id)).toBe(true);
    expect(stmt?.likes.some((l) => l.user.massr_id === user0.massr_id)).toBe(false);
  });

  it("同じ人が2回イイネしても1件のまま", async () => {
    const user0 = await createUser(db(), createInput(0));
    const user1 = await createUser(db(), createInput(1));
    const created = await createStatement(db(), {
      userId: user0.id,
      body: "x",
      stampUrl: null,
      resId: null,
      photos: [],
    });
    await addLike(db(), created!.row.id, user1.id);
    await addLike(db(), created!.row.id, user1.id);
    const stmt = await getStatementById(db(), created!.row.id);
    expect(stmt?.likes.length).toBe(1);
  });
});

describe("statementToHash（元の to_hash）", () => {
  it("元の to_hash と同じ形を返す", async () => {
    const user = await createUser(db(), createInput(0));
    const p = prototypeStatement(0);
    const created = await createStatement(db(), {
      userId: user.id,
      body: p.body,
      stampUrl: null,
      resId: null,
      photos: p.photos,
    });
    await addLike(db(), created!.row.id, user.id);
    const stmt = await getStatementById(db(), created!.row.id);
    const hash = statementToHash(stmt!);
    expect(hash.created_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(typeof hash.id).toBe("string");
    expect(hash.body).toBe(p.body);
    expect(hash.user.name).toBe(user.name);
    expect(Array.isArray(hash.likes)).toBe(true);
    expect(hash.ref_ids).toEqual([]);
    expect(hash.res).toBeNull();
  });
});

describe("getStatements（元の get_statements）", () => {
  it("新しい順に全件返り、本文の部分一致で絞れる", async () => {
    const user0 = await createUser(db(), createInput(0));
    await createStatement(db(), {
      userId: user0.id,
      body: prototypeStatement(0).body,
      stampUrl: null,
      resId: null,
      photos: [],
    });
    const user1 = await createUser(db(), createInput(1));
    await createStatement(db(), {
      userId: user1.id,
      body: prototypeStatement(1).body,
      stampUrl: null,
      resId: null,
      photos: [],
    });
    const all = await getStatements(db(), { before: nowSec() + 600 });
    expect(all.length).toBe(2);
    const filtered = await getStatements(db(), {
      before: nowSec() + 600,
      search: "ほんぶんだよ！",
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].row.body).toBe(prototypeStatement(0).body);
  });
});
