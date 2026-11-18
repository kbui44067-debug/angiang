import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_FILE_PATH =
  process.env.SHARED_DATA_PATH || path.join(process.cwd(), "shared-travel-data.json");
const BACKUP_DIR = path.join(path.dirname(DATA_FILE_PATH), "backups");

// Hàng đợi: các lượt ghi chạy lần lượt, không bao giờ chồng nhau
let writeQueue: Promise<unknown> = Promise.resolve();

async function readLatestValidBackup(): Promise<any | null> {
  try {
    const files = (await fs.readdir(BACKUP_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse(); // tên có thời gian nên mới nhất đứng đầu
    for (const f of files) {
      try {
        const data = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, f), "utf-8"));
        if (data && Array.isArray(data.places) && data.places.length > 0) return data;
      } catch {}
    }
  } catch {}
  return null;
}

export async function GET() {
  let raw: string;
  try {
    raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return NextResponse.json(null);
    return NextResponse.json({ error: "READ_FAILED", details: String(err) }, { status: 500 });
  }

  try {
    return NextResponse.json(JSON.parse(raw), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[/api/state] File JSON bị hỏng:", String(err));
    // Giữ lại bản hỏng để kiểm tra, rồi nạp từ sao lưu
    await fs.copyFile(DATA_FILE_PATH, DATA_FILE_PATH + `.corrupt-${Date.now()}`).catch(() => {});
    const backup = await readLatestValidBackup();
    if (backup) {
      console.warn("[/api/state] Đã khôi phục từ bản sao lưu gần nhất.");
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
      { status: 500 }
    );
  }
}