import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import {
  AVATAR_DIMENSION,
  AVATAR_ORPHAN_GRACE_MS,
  MAX_AVATAR_PNG_BYTES,
  cleanupAvatarOrphans,
  decodeAvatarBase64,
  isManagedAvatarPath,
  removeManagedAvatar,
  storeAvatarPng,
  validateAvatarPng,
} from "../src/shared/lib/avatar-storage";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.byteLength);
  chunk.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.byteLength);
  return chunk;
}

function pngHeader(width = AVATAR_DIMENSION, height = AVATAR_DIMENSION) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return pngChunk("IHDR", header);
}

function avatarPng(options: { width?: number; height?: number; filter?: number } = {}) {
  const width = options.width ?? AVATAR_DIMENSION;
  const height = options.height ?? AVATAR_DIMENSION;
  const rowLength = width * 4 + 1;
  const pixels = Buffer.alloc(rowLength * height);
  for (let row = 0; row < height; row += 1) pixels[row * rowLength] = options.filter ?? 0;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngHeader(width, height),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND"),
  ]);
}

test("头像验证接受完整的 512×512 RGBA PNG", () => {
  assert.doesNotThrow(() => validateAvatarPng(avatarPng()));
});

test("头像验证拒绝伪造、越界、错误尺寸与损坏压缩数据", () => {
  const valid = avatarPng();
  assert.throws(() => validateAvatarPng(Buffer.from("not-png")), /有效的 PNG/);
  assert.throws(() => validateAvatarPng(Buffer.alloc(MAX_AVATAR_PNG_BYTES + 1)), /小于 2 MiB/);
  assert.throws(() => validateAvatarPng(avatarPng({ width: 511 })), /512×512/);
  assert.throws(() => validateAvatarPng(avatarPng({ filter: 5 })), /过滤器/);
  assert.throws(
    () => validateAvatarPng(Buffer.concat([
      PNG_SIGNATURE,
      pngHeader(),
      pngChunk("IDAT", Buffer.from([1, 2, 3])),
      pngChunk("IEND"),
    ])),
    /压缩数据无效或过大/,
  );
  assert.throws(() => validateAvatarPng(valid.subarray(0, valid.byteLength - 12)), /不完整/);
  assert.throws(() => validateAvatarPng(Buffer.concat([valid, Buffer.from("tail")])), /结尾无效或包含尾随数据/);
});

test("头像验证拒绝被辅助块打断的 IDAT 与错位调色板", () => {
  const raw = Buffer.alloc((AVATAR_DIMENSION * 4 + 1) * AVATAR_DIMENSION);
  const compressed = deflateSync(raw);
  const midpoint = Math.floor(compressed.byteLength / 2);
  assert.throws(
    () => validateAvatarPng(Buffer.concat([
      PNG_SIGNATURE,
      pngHeader(),
      pngChunk("IDAT", compressed.subarray(0, midpoint)),
      pngChunk("tEXt", Buffer.from("safe")),
      pngChunk("IDAT", compressed.subarray(midpoint)),
      pngChunk("IEND"),
    ])),
    /图像数据顺序无效/,
  );
  assert.throws(
    () => validateAvatarPng(Buffer.concat([
      PNG_SIGNATURE,
      pngHeader(),
      pngChunk("IDAT", compressed),
      pngChunk("PLTE", Buffer.from([0, 0, 0])),
      pngChunk("IEND"),
    ])),
    /调色板顺序或长度无效/,
  );
});

test("受管头像路径只接受 uploads/avatars 下的 UUID v4 PNG", () => {
  assert.equal(isManagedAvatarPath("/uploads/avatars/123e4567-e89b-42d3-a456-426614174000.png"), true);
  assert.equal(isManagedAvatarPath("/avatar/default.png"), false);
  assert.equal(isManagedAvatarPath("/uploads/avatars/../secret.png"), false);
  assert.equal(isManagedAvatarPath("/uploads/avatars/not-a-uuid.png"), false);
  assert.equal(isManagedAvatarPath(null), false);
});

test("头像上传只接受规范且无空白的 base64", () => {
  assert.deepEqual(decodeAvatarBase64("AA=="), Buffer.from([0]));
  assert.throws(() => decodeAvatarBase64("AB=="), /编码无效/);
  assert.throws(() => decodeAvatarBase64("AA==\n"), /编码无效/);
  assert.throws(() => decodeAvatarBase64("AA="), /编码无效/);
});

test("头像文件使用原子名称写入并只删除受管文件", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lab-avatar-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const bytes = avatarPng();
  const publicPath = await storeAvatarPng(bytes, directory);
  assert.equal(isManagedAvatarPath(publicPath), true);
  assert.deepEqual(await readFile(join(directory, publicPath.split("/").at(-1)!)), bytes);
  assert.equal(await removeManagedAvatar(publicPath, directory), true);
  assert.equal(await removeManagedAvatar(publicPath, directory), false);
  assert.equal(await removeManagedAvatar("/avatar/default.png", directory), false);
});

test("孤儿清理移除过期最终文件和崩溃遗留临时文件，保留仍被引用的头像", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lab-avatar-orphans-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const kept = "123e4567-e89b-42d3-a456-426614174000.png";
  const orphan = "123e4567-e89b-42d3-a456-426614174001.png";
  const temporary = ".123e4567-e89b-42d3-a456-426614174002.tmp";
  await Promise.all([
    writeFile(join(directory, kept), "kept"),
    writeFile(join(directory, orphan), "orphan"),
    writeFile(join(directory, temporary), "temporary"),
  ]);
  const now = Date.now();
  const old = new Date(now - AVATAR_ORPHAN_GRACE_MS - 1_000);
  await Promise.all([
    utimes(join(directory, kept), old, old),
    utimes(join(directory, orphan), old, old),
    utimes(join(directory, temporary), old, old),
  ]);

  assert.equal(
    await cleanupAvatarOrphans(new Set([`/uploads/avatars/${kept}`]), now, directory),
    2,
  );
  assert.deepEqual(await readdir(directory), [kept]);
});
