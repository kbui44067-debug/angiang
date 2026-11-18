import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateHaversineDistanceKm } from "@/lib/geo";

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().refine((val) => [1, 3, 5, 10, 20].includes(val), {
    message: "Bán kính hợp lệ: 1, 3, 5, 10 hoặc 20 km",
  }),
  category: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = nearbyQuerySchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radiusKm: searchParams.get("radiusKm") || 5,
    category: searchParams.get("category") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tham số tọa độ hoặc bán kính không hợp lệ", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { lat, lng, radiusKm, category } = parsed.data;

  // Khi kết nối Prisma DB: lấy danh sách địa điểm hiển thị (isVisible: true)
  // Tính khoảng cách thực tế từ vị trí người dùng và lọc theo radiusKm
  const hasGooglePlacesKey = Boolean(process.env.GOOGLE_PLACES_SERVER_API_KEY);

  return NextResponse.json({
    meta: {
      userLocation: { lat, lng },
      radiusKm,
      category: category || "ALL",
      googleApiConfigured: hasGooglePlacesKey,
      notice: hasGooglePlacesKey
        ? undefined
        : "Chưa cấu hình GOOGLE_PLACES_SERVER_API_KEY. Đang hiển thị dữ liệu địa phương kèm nhãn DEMO.",
    },
    calculateDistanceSample: calculateHaversineDistanceKm(lat, lng, 10.0125, 105.0809),
  });
}