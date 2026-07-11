import { randomUUID } from "node:crypto";
import { mkdir, lstat, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { inflateSync } from "node:zlib";

export const DEFAULT_AVATAR_PATH = "/avatar/default.png";
export const AVATAR_DIMENSION = 512;
export const MAX_AVATAR_PNG_BYTES = 2 * 1024 * 1024;
export const AVATAR_ORPHAN_GRACE_MS = 15 * 60 * 1000;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MANAGED_AVATAR_PATTERN = /^\/uploads\/avatars\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.png$/i;
const TEMPORARY_AVATAR_PATTERN = /^\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.tmp$/i;
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function avatarDirectory() {
  return join(process.cwd(), "public", "uploads", "avatars");
}

function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function isManagedAvatarPath(value: string | null | undefined) {
  return Boolean(value && MANAGED_AVATAR_PATTERN.test(value));
}

export function decodeAvatarBase64(value: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("头像数据编码无效。");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("头像数据编码无效。");
  return bytes;
}

export function validateAvatarPng(bytes: Buffer) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_PNG_BYTES) {
    throw new Error("头像 PNG 必须小于 2 MiB。");
  }
  if (bytes.byteLength < PNG_SIGNATURE.byteLength || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("头像文件不是有效的 PNG。");
  }

  let offset = 8;
  let chunkCount = 0;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let sawHeader = false;
  let sawImageData = false;
  let imageDataEnded = false;
  let sawPalette = false;
  let sawEnd = false;
  const imageData: Buffer[] = [];

  while (offset < bytes.byteLength) {
    if (chunkCount >= 128 || offset + 12 > bytes.byteLength) throw new Error("头像 PNG 结构异常。");
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (length > MAX_AVATAR_PNG_BYTES || chunkEnd > bytes.byteLength) throw new Error("头像 PNG 数据块越界。");
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("头像 PNG 数据块类型无效。");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== expectedCrc) throw new Error("头像 PNG 校验失败。");

    if (chunkCount === 0 && type !== "IHDR") throw new Error("头像 PNG 缺少首部。");
    if (type === "IHDR") {
      if (sawHeader || length !== 13) throw new Error("头像 PNG 首部无效。");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9] ?? -1;
      if (
        width !== AVATAR_DIMENSION
        || height !== AVATAR_DIMENSION
        || bitDepth !== 8
        || (colorType !== 2 && colorType !== 6)
        || data[10] !== 0
        || data[11] !== 0
        || data[12] !== 0
      ) {
        throw new Error("头像必须是 512×512、8 位、非隔行 PNG。");
      }
      sawHeader = true;
    } else if (type === "IDAT") {
      if (!sawHeader || sawEnd || imageDataEnded) throw new Error("头像 PNG 图像数据顺序无效。");
      sawImageData = true;
      imageData.push(data);
    } else if (type === "PLTE") {
      if (!sawHeader || sawImageData || sawPalette || length === 0 || length > 768 || length % 3 !== 0) {
        throw new Error("头像 PNG 调色板顺序或长度无效。");
      }
      sawPalette = true;
    } else if (type === "IEND") {
      if (!sawImageData || length !== 0 || chunkEnd !== bytes.byteLength) {
        throw new Error("头像 PNG 结尾无效或包含尾随数据。");
      }
      sawEnd = true;
    } else if ((typeBytes[0] ?? 0) >= 65 && (typeBytes[0] ?? 0) <= 90) {
      throw new Error("头像 PNG 包含不支持的关键数据块。");
    }

    if (sawImageData && type !== "IDAT") imageDataEnded = true;

    offset = chunkEnd;
    chunkCount += 1;
  }
  if (!sawHeader || !sawImageData || !sawEnd) throw new Error("头像 PNG 不完整。");

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowLength = width * bytesPerPixel + 1;
  const expectedLength = rowLength * height;
  let decoded: Buffer;
  try {
    decoded = inflateSync(Buffer.concat(imageData), { maxOutputLength: expectedLength });
  } catch {
    throw new Error("头像 PNG 压缩数据无效或过大。");
  }
  if (decoded.byteLength !== expectedLength) throw new Error("头像 PNG 解码长度无效。");
  for (let row = 0; row < height; row += 1) {
    if ((decoded[row * rowLength] ?? 5) > 4) throw new Error("头像 PNG 行过滤器无效。");
  }
}

export async function storeAvatarPng(bytes: Buffer, directory = avatarDirectory()) {
  validateAvatarPng(bytes);
  await mkdir(directory, { recursive: true });
  const id = randomUUID();
  const finalName = `${id}.png`;
  const temporaryName = `.${id}.tmp`;
  const temporaryPath = join(directory, temporaryName);
  await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o644 });
  try {
    await rename(temporaryPath, join(directory, finalName));
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
  return `/uploads/avatars/${finalName}`;
}

export async function removeManagedAvatar(path: string | null | undefined, directory = avatarDirectory()) {
  const match = path?.match(MANAGED_AVATAR_PATTERN);
  if (!match) return false;
  const filePath = join(directory, basename(path!));
  try {
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    await unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function cleanupAvatarOrphans(
  referencedPaths: ReadonlySet<string>,
  now = Date.now(),
  directory = avatarDirectory(),
) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let removed = 0;
  for (const entry of entries) {
    const publicPath = `/uploads/avatars/${entry.name}`;
    const isTemporary = TEMPORARY_AVATAR_PATTERN.test(entry.name);
    const isUnreferencedAvatar = MANAGED_AVATAR_PATTERN.test(publicPath) && !referencedPaths.has(publicPath);
    if (!entry.isFile() || (!isTemporary && !isUnreferencedAvatar)) continue;
    const filePath = join(directory, entry.name);
    const stat = await lstat(filePath);
    if (stat.isSymbolicLink() || now - stat.mtimeMs < AVATAR_ORPHAN_GRACE_MS) continue;
    await unlink(filePath);
    removed += 1;
  }
  return removed;
}
