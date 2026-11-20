import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
// Nếu file thật của bạn đã có dòng import này (hoặc đường dẫn khác) thì giữ nguyên dòng cũ, bỏ dòng này
import { applyStateDelta, SharedState, StateDelta } from "../../../lib/sync";

const DATA_FILE_PATH =
  process.env.SHARED_DATA_PATH || path.join(/*turbopackIgnore: true*/ process.cwd(), "shared-travel-data.json");
const BACKUP_DIR = path.join(path.dirname(DATA_FILE_PATH), "backups");

// Hàng đợi: "đọc -> áp thay đổi -> ghi" chạy lần lượt, không bao giờ chồng nhau
// (chỉ an toàn khi chạy 1 tiến trình Node; nếu chạy nhiều tiến trình cần khóa file/DB)
let writeQueue: Promise<unknown> = Promise.resolve();
let healQueue: Promise<any> = Promise.resolve();

async function readLatestValidBackup(): Promise<any | null> {
  try {
    const files = (await fs.readdir(/*turbopackIgnore: true*/ BACKUP_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();
    for (const f of files) {
      try {
        const data = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ path.join(BACKUP_DIR, f), "utf-8"));
        if (data && Array.isArray(data.places) && data.places.length > 0) return data;
      } catch {}
    }
  } catch {}
  return null;
}

// Ghi file kiểu "ghi ra file tạm rồi đổi tên đè lên". Trên Windows, đổi tên đôi khi bị chặn tạm thời
// (antivirus, OneDrive/Dropbox đang quét file) nên thử lại vài lần.
async function writeFileAtomic(target: string, content: string) {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const handle = await fs.open(/*turbopackIgnore: true*/ tmp, "w");
  try {
    await handle.writeFile(content, "utf-8");
    await handle.sync(); // đảm bảo dữ liệu đã xuống đĩa trước khi đổi tên
  } finally {
    await handle.close();
  }
  let lastErr: any;
  for (let i = 0; i < 6; i++) {
    try {
      await fs.rename(/*turbopackIgnore: true*/ tmp, target);
      return;
    } catch (err: any) {
      lastErr = err;
      if (!["EPERM", "EBUSY", "EACCES"].includes(err?.code)) break;
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  await fs.unlink(/*turbopackIgnore: true*/ tmp).catch(() => {});
  throw lastErr;
}

// Trả về: null = chưa có file; ném lỗi = đọc lỗi / hỏng mà không có backup
async function loadCurrent(): Promise<SharedState | null> {
  let raw: string;
  try {
    raw = await fs.readFile(/*turbopackIgnore: true*/ DATA_FILE_PATH, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[/api/state] File JSON bị hỏng:", String(err));
    // Chạy trong hàng đợi để không chồng với lần ghi khác, và CHỈ sửa file 1 lần
    // (trước đây mỗi lần đọc lại sao chép 1 bản .corrupt và không sửa file nên log lặp mãi)
    const healed = (healQueue = healQueue.then(async () => {
      try {
        // Có thể lần gọi trước đã sửa xong
        return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ DATA_FILE_PATH, "utf-8")) as SharedState;
      } catch {}
      const backup = await readLatestValidBackup();
      if (!backup) return null;
      await fs.copyFile(/*turbopackIgnore: true*/ DATA_FILE_PATH, DATA_FILE_PATH + `.corrupt-${Date.now()}`).catch(() => {});
      await writeFileAtomic(DATA_FILE_PATH, JSON.stringify(backup, null, 2));
      console.warn("[/api/state] Đã khôi phục từ bản sao lưu gần nhất và ghi lại file dữ liệu.");
      return backup as SharedState;
    }));
    const restored = await healed;
    if (restored) return restored;
    throw err;
  }
}

const emptyState = (): SharedState => ({
  version: 0,
  places: [],
  regions: [],
  users: [],
  reviews: [],
  savedTrips: [],
  transitHubs: [],
});

// GET /api/state            -> toàn bộ dữ liệu (có "version")
// GET /api/state?since=N    -> nếu version vẫn là N thì chỉ trả {unchanged:true} (dùng để poll nhẹ)
export async function GET(req: NextRequest) {
  try {
    const state = await loadCurrent();
    if (!state) return NextResponse.json(null);

    const since = req.nextUrl.searchParams.get("since");
    const version = state.version ?? 0;
    if (since !== null && Number(since) === version) {
      return NextResponse.json({ unchanged: true, version }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ...state, version }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "READ_FAILED", details: String(err) }, { status: 500 });
  }
}

// POST /api/state { changes: StateDelta }
// Server áp "phần thay đổi" lên file hiện tại rồi trả về bản mới nhất (đã gộp) kèm version.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const changes: StateDelta | undefined = body?.changes;
    if (!changes || typeof changes !== "object") {
      // Không nhận kiểu gửi cả file nữa vì sẽ đè dữ liệu của người khác
      return NextResponse.json({ ok: false, error: "CHANGES_REQUIRED" }, { status: 400 });
    }

    const job = writeQueue.then(async () => {
      const current = (await loadCurrent()) ?? emptyState();
      const next = applyStateDelta(current, changes);
      next.version = (current.version ?? 0) + 1;

      // Chống mất dữ liệu: không cho một lần lưu biến file đang có dữ liệu thành rỗng
      const hadData = (current.places?.length ?? 0) > 0 || (current.regions?.length ?? 0) > 0;
      const nowEmpty = next.places.length === 0 && next.regions.length === 0;
      if (hadData && nowEmpty) throw new Error("EMPTY_GUARD");

      const json = JSON.stringify(next, null, 2);
      JSON.parse(json); // chắc chắn nội dung sắp ghi là JSON hợp lệ
      await writeFileAtomic(DATA_FILE_PATH, json);
      return next;
    });
    writeQueue = job.catch(() => {});
    const saved = (await job) as SharedState;

    return NextResponse.json({ ok: true, version: saved.version, state: saved });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("EMPTY_GUARD")) {
      return NextResponse.json({ ok: false, skipped: "EMPTY_DATA" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Không thể lưu dữ liệu lên Server", details: msg },
      { status: 500 }
    );
  }
}
