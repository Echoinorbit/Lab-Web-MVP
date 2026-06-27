import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_USERS_PAGE_SIZE } from "../src/features/admin/lib/pagination";
import { DEFAULT_PAGE_SIZE, getPaginationState, getTotalPages, parsePageParam } from "../src/shared/lib/pagination";

test("分页页码解析应拒绝空值、负数、小数和非数字", () => {
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam(""), 1);
  assert.equal(parsePageParam("-1"), 1);
  assert.equal(parsePageParam("1.5"), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam(["3", "4"]), 3);
});

test("分页总页数至少为 1，并按默认 10 条每页计算", () => {
  assert.equal(DEFAULT_PAGE_SIZE, 10);
  assert.equal(getTotalPages(0), 1);
  assert.equal(getTotalPages(1), 1);
  assert.equal(getTotalPages(10), 1);
  assert.equal(getTotalPages(11), 2);
});

test("分页状态应夹紧越界页并给出 skip 与边界状态", () => {
  assert.deepEqual(getPaginationState({ page: 0, totalItems: 21 }), {
    currentPage: 1,
    pageSize: 10,
    totalPages: 3,
    skip: 0,
    canPrevious: false,
    canNext: true,
  });
  assert.deepEqual(getPaginationState({ page: 9, totalItems: 21 }), {
    currentPage: 3,
    pageSize: 10,
    totalPages: 3,
    skip: 20,
    canPrevious: true,
    canNext: false,
  });
});

test("管理员用户列表固定为每页 5 个用户", () => {
  assert.equal(ADMIN_USERS_PAGE_SIZE, 5);
  assert.equal(getTotalPages(11, ADMIN_USERS_PAGE_SIZE), 3);
});
