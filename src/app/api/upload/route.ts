// VỊ TRÍ FILE: src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Ảnh lưu cạnh file dữ liệu: <thư mục shared-travel-data.json>/uploads
const DATA_FILE_PATH =
  process.env.SHARED_DATA_PATH || path.join(process.cwd(), "shared-travel-data.json");
const UPLOAD_DIR = path.join(path.dirname(DATA_FILE_PATH), "uploads");

const MAX_BYTES = 8 * 1024 * 1024; // 8MB (client đã nén còn vài trăm KB)
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file ảnh" }, { status: 400 });
    }
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Chỉ nhận ảnh JPG, PNG, WEBP, GIF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Ảnh quá lớn (tối đa 8MB)" }, { status: 413 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/api/upload/${name}` });
  } catch (err) {
    return NextResponse.json(
      { error: "Không thể lưu ảnh", details: String(err) },
      { status: 500 }
    );
  }
}