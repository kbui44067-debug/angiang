// VỊ TRÍ FILE: src/app/api/upload/[name]/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_FILE_PATH =
  process.env.SHARED_DATA_PATH || path.join(process.cwd(), "shared-travel-data.json");
const UPLOAD_DIR = path.join(path.dirname(DATA_FILE_PATH), "uploads");

const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Chỉ nhận đúng dạng tên do route upload tạo ra, chặn đường dẫn lạ (../)
const SAFE_NAME = /^\d+-[a-f0-9]{12}\.(jpg|png|webp|gif)$/;

export async function GET(_req: Request, context: { params: any }) {
  const { name } = await context.params; // chạy được cả Next 14 và 15
  const match = typeof name === "string" ? SAFE_NAME.exec(name) : null;
  if (!match) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPE_BY_EXT[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}