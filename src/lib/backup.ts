import fs from "fs";
import path from "path";
import crypto from "crypto";

// Sao lưu file dữ liệu chính (shared-travel-data.json) sang thư mục "backups" ở gốc dự án.
const FILE_NAME = "shared-travel-data.json";
const MAX_BACKUPS = 30; // giữ tối đa 30 bản mới nhất

export type BackupInfo = {
  name: string;
  size: number;
  places: number;
  reason: string;
  createdAt: string;
};

const NAME_RE = /^data-(\d{8})-(\d{6})-([a-z]+)-p(\d+)-([0-9a-f]{8})\.json$/;

function backupDir(): string {
  return path.join(process.cwd(), "backups");
}

// Tìm file dữ liệu chính (thử vài vị trí thường gặp)
export function findDataFile(): string | null {
  const root = process.cwd();
  const candidates = [
    path.join(root, FILE_NAME),
    path.join(root, "data", FILE_NAME),
    path.join(root, "src", FILE_NAME),
    path.join(root, "src", "data", FILE_NAME),
    path.join(root, "public", FILE_NAME),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function countPlaces(raw: string): number {
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data?.places) ? data.places.length : 0;
  } catch {
    return -1; // JSON hỏng
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(d = new Date()): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function listBackups(): BackupInfo[] {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  const result: BackupInfo[] = [];
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(NAME_RE);
    if (!m) continue;
    const st = fs.statSync(path.join(dir, name));
    result.push({
      name,
      size: st.size,
      places: parseInt(m[4], 10),
      reason: m[3],
      createdAt: st.mtime.toISOString(),
    });
  }
  return result.sort((a, b) => (a.name < b.name ? 1 : -1)); // mới nhất trước
}

// Chụp 1 bản sao của file dữ liệu hiện tại. Bỏ qua nếu dữ liệu rỗng/hỏng hoặc giống hệt bản mới nhất.
export function createBackup(reasonRaw = "manual"): {
  ok: boolean;
  name?: string;
  skipped?: string;
} {
  const src = findDataFile();
  if (!src) return { ok: false, skipped: "NO_DATA_FILE" };

  const raw = fs.readFileSync(src, "utf8");
  const count = countPlaces(raw);
  if (count < 0) return { ok: false, skipped: "INVALID_JSON" };
  if (count === 0) return { ok: false, skipped: "EMPTY_DATA" }; // không sao lưu đè bản rỗng

  const hash8 = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 8);
  const newest = listBackups()[0];
  if (newest && newest.name.endsWith(`-${hash8}.json`)) {
    return { ok: false, skipped: "UNCHANGED" };
  }

  const reason = reasonRaw.toLowerCase().replace(/[^a-z]/g, "").slice(0, 16) || "manual";
  const name = `data-${stamp()}-${reason}-p${count}-${hash8}.json`;
  fs.mkdirSync(backupDir(), { recursive: true });
  fs.writeFileSync(path.join(backupDir(), name), raw, "utf8");

  // Xóa bớt bản cũ nếu quá giới hạn
  const all = listBackups();
  for (const old of all.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(backupDir(), old.name));
    } catch {}
  }
  return { ok: true, name };
}

export function readBackup(name: string): string | null {
  if (!NAME_RE.test(name)) return null;
  const p = path.join(backupDir(), name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// Khôi phục: tự sao lưu bản hiện tại trước, rồi ghi đè file chính bằng bản đã chọn.
export function restoreBackup(name: string): { ok: boolean; error?: string } {
  const raw = readBackup(name);
  if (raw === null) return { ok: false, error: "BACKUP_NOT_FOUND" };
  if (countPlaces(raw) < 0) return { ok: false, error: "BACKUP_INVALID" };

  const target = findDataFile() || path.join(process.cwd(), FILE_NAME);
  try {
    createBackup("beforerestore");
  } catch {}

  const tmp = `${target}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, raw, "utf8");
  fs.renameSync(tmp, target);
  return { ok: true };
}