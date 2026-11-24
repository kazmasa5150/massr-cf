// 元の spec/models/user_spec.rb の移植。
// twitter_* フィールドは移植版に無いため icon_url に読み替え、
// プロフィール更新で email が変わらない点は移植版の意図的な差分
// （email は Cloudflare Access の本人確認キー）として検証する。
import { describe, it, expect } from "vitest";
import {
  STATUS,
  changeUserStatus,
  createUser,
  getUserByMassrId,
  updateUserProfile,
  userToHash,
} from "../src/models";
import { createInput, db, prototypeUser } from "./helpers";

describe("createUser（元の create_by_registration_form）", () => {
  it("最初のユーザは管理者として登録される", async () => {
    const user = await createUser(db(), createInput(0));
    const p = prototypeUser(0);
    expect(user.massr_id).toBe(p.massr_id);
    expect(user.name).toBe(p.name);
    expect(user.email).toBe(p.email);
    expect(user.icon_url).toBe(p.twitter_icon_url);
    expect(user.status).toBe(STATUS.ADMIN);
  });

  it("2番目のユーザは未認可として登録される", async () => {
    await createUser(db(), createInput(0));
    const user = await createUser(db(), createInput(1));
    const p = prototypeUser(1);
    expect(user.massr_id).toBe(p.massr_id);
    expect(user.name).toBe(p.name);
    expect(user.email).toBe(p.email);
    expect(user.icon_url).toBe(p.twitter_icon_url);
    expect(user.status).toBe(STATUS.UNAUTHORIZED);
  });
});

describe("changeUserStatus（元の change_status）", () => {
  it("未認可アカウントを認可できる", async () => {
    await createUser(db(), createInput(0));
    const user = await createUser(db(), createInput(1));
    await changeUserStatus(db(), user.massr_id, STATUS.AUTHORIZED);
    const after = await getUserByMassrId(db(), user.massr_id);
    expect(after?.status).toBe(STATUS.AUTHORIZED);
  });

  it("不正なステータス値では変更されない", async () => {
    await createUser(db(), createInput(0));
    const user = await createUser(db(), createInput(1));
    await changeUserStatus(db(), user.massr_id, 5);
    const after = await getUserByMassrId(db(), user.massr_id);
    expect(after?.status).toBe(STATUS.UNAUTHORIZED);
  });
});

describe("updateUserProfile（元の update_profile）", () => {
  it("名前とアイコンを更新でき、massr_id と email は変わらない", async () => {
    const user = await createUser(db(), createInput(0));
    const p1 = prototypeUser(1);
    await updateUserProfile(db(), user.id, {
      name: p1.name,
      icon_url: p1.twitter_icon_url,
    });
    const after = await getUserByMassrId(db(), user.massr_id);
    expect(after?.name).toBe(p1.name);
    expect(after?.icon_url).toBe(p1.twitter_icon_url);
    // massr_id を変えてはいけない（元の spec のコメント通り）
    expect(after?.massr_id).toBe(prototypeUser(0).massr_id);
    // 移植版では email は本人確認キーなのでプロフィール更新では変わらない
    expect(after?.email).toBe(prototypeUser(0).email);
  });
});

describe("管理者・認可の判定（元の admin? / authorized?）", () => {
  it("最初のユーザは管理者かつ認可済", async () => {
    const user = await createUser(db(), createInput(0));
    expect(user.status === STATUS.ADMIN).toBe(true);
    expect(user.status !== STATUS.UNAUTHORIZED).toBe(true);
  });

  it("2番目のユーザは管理者ではなく未認可", async () => {
    await createUser(db(), createInput(1));
    const user = await createUser(db(), createInput(0));
    expect(user.status === STATUS.ADMIN).toBe(false);
    expect(user.status !== STATUS.UNAUTHORIZED).toBe(false);
  });

  it("認可されたユーザは管理者ではないが認可済", async () => {
    await createUser(db(), createInput(0));
    const user = await createUser(db(), createInput(1));
    await changeUserStatus(db(), user.massr_id, STATUS.AUTHORIZED);
    const after = await getUserByMassrId(db(), user.massr_id);
    expect(after?.status === STATUS.ADMIN).toBe(false);
    expect(after?.status !== STATUS.UNAUTHORIZED).toBe(true);
  });
});

describe("userToHash（元の to_hash）", () => {
  it("元の to_hash と同じ形を返す", async () => {
    const user = await createUser(db(), createInput(0));
    const hash = userToHash(user);
    expect(typeof hash.id).toBe("string");
    expect(hash.massr_id).toBe("wasamas");
    expect(hash.name).toBeTruthy();
    expect(hash.email).toBe("wasamas@example.com");
    expect(hash.status).toBe(0);
    // 移植版では twitter_icon_url は icon_url の別名として返す
    expect(hash.twitter_icon_url).toBe(prototypeUser(0).twitter_icon_url);
    expect(hash.twitter_icon_url_https).toBe(prototypeUser(0).twitter_icon_url);
  });
});
