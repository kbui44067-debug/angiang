import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
<<<<<<< HEAD
import { applyStateDelta, SharedState, StateDelta } from "../../../lib/sync";
=======
>>>>>>> 03d4000873ca1d029bc82f912125f5053d254185

const DATA_FILE_PATH =
  process.env.SHARED_DATA_PATH || path.join(process.cwd(), "shared-travel-data.json");
const BACKUP_DIR = path.join(path.dirname(DATA_FILE_PATH), "backups");

<<<<<<< HEAD
// Hàng đợi: "đọc -> áp thay đổi -> ghi" chạy lần lượt, không bao giờ chồng nhau
// (chỉ an toàn khi chạy 1 tiến trình Node; nếu chạy nhiều tiến trình cần khóa file/DB)
=======
// Hàng đợi: các lượt ghi chạy lần lượt, không bao giờ chồng nhau
>>>>>>> 03d4000873ca1d029bc82f912125f5053d254185
let writeQueue: Promise<unknown> = Promise.resolve();

async function readLatestValidBackup(): Promise<any | null> {
  try {
    const files = (await fs.readdir(BACKUP_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort()
<<<<<<< HEAD
      .reverse();
=======
      .reverse(); // tên có thời gian nên mới nhất đứng đầu
>>>>>>> 03d4000873ca1d029bc82f912125f5053d254185
    for (const f of files) {
      try {
        const data = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, f), "utf-8"));
        if (data && Array.isArray(data.places) && data.places.length > 0) return data;
      } catch {}
    }
  } catch {}
  return null;
}

<<<<<<< HEAD
// Trả về: null = chưa có file; ném lỗi = đọc lỗi / hỏng mà không có backup
async function loadCurrent(): Promise<SharedState | null> {
=======
export async function GET() {
>>>>>>> 03d4000873ca1d029bc82f912125f5053d254185
  let raw: string;
  try {
    raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
  } catch (err: any) {
<<<<<<< HEAD
    if (err?.code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[/api/state] File JSON bị hỏng:", String(err));
=======
    if (err?.code === "ENOENT") return NextResponse.json(null);
    return NextResponse.json({ error: "READ_FAILED", details: String(err) }, { status: 500 });
  }

  try {
    return NextResponse.json(JSON.parse(raw), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[/api/state] File JSON bị hỏng:", String(err));
    // Giữ lại bản hỏng để kiểm tra, rồi nạp từ sao lưu
>>>>>>> 03d4000873ca1d029bc82f912125f5053d254185
    await fs.copyFile(DATA_FILE_PATH, DATA_FILE_PATH + `.corrupt-${Date.now()}`).catch(() => {});
    const backup = await readLatestValidBackup();
    if (backup) {
      console.warn("[/api/state] Đã khôi phục từ bản sao lưu gần nhất.");
<<<<<<< HEAD
      return backup;
    }
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

      const tmp = `${DATA_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
      await fs.rename(tmp, DATA_FILE_PATH);
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
=======
      return NextResponse.json(backup, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "CORRUPT_JSON", details: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const empty =
      !body ||
      ((!Array.isArray(body.places) || body.places.length === 0) &&
        (!Array.isArray(body.regions) || body.regions.length === 0));
    if (empty) return NextResponse.json({ ok: false, skipped: "EMPTY_DATA" });

    const text = JSON.stringify(body, null, 2);
    const job = writeQueue.then(async () => {
      const tmp = `${DATA_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, text, "utf-8");
      await fs.rename(tmp, DATA_FILE_PATH);
    });
    writeQueue = job.catch(() => {}); // lỗi một lượt không làm kẹt hàng đợi
    await job;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Không thể lưu dữ liệu lên Server", details: String(err) },
>>>>>>> 03d4000873ca1d029bc82f912125f5053d254185
      { status: 500 }
    );
  }
}