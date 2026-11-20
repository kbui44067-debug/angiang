import { NextResponse } from "next/server";
import { createBackup, listBackups, readBackup, restoreBackup } from "../../../lib/backup";

// GET /api/backup            -> danh sách các bản sao lưu
// GET /api/backup?download=X -> tải 1 bản sao lưu về máy
export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("download");

  if (file) {
    const raw = readBackup(file);
    if (raw === null) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return new Response(raw, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  }

  return NextResponse.json({ backups: listBackups() }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/backup {reason}   -> sao lưu ngay
// POST /api/backup {restore}  -> khôi phục từ 1 bản sao lưu
export async function POST(request: Request) {
  let body: { reason?: string; restore?: string } = {};
  try {
    body = await request.json();
  } catch {}

  if (body.restore) {
    const r = restoreBackup(String(body.restore));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  try {
    return NextResponse.json(createBackup(String(body.reason || "manual")));
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}