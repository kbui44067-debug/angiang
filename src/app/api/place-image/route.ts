// Đặt tại: app/api/place-image/route.ts  (thay file cũ dùng Gemini)
//
// Lấy ảnh địa điểm từ Google Maps (Places API New):
//   1) Text Search: tìm đúng địa điểm theo "tên + địa chỉ" (ưu tiên gần tọa độ nếu có)
//   2) Place Photos: lấy ảnh đầu tiên của địa điểm đó
//
// Cần trong .env.local:
//   GOOGLE_MAPS_API_KEY=xxxx
// và bật "Places API (New)" trong Google Cloud Console.

import { NextRequest, NextResponse } from "next/server";



const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const MAX_DISTANCE_KM = 3; // Kết quả cách tọa độ nhập quá xa thì bỏ, tránh gắn nhầm ảnh

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export async function GET(req: NextRequest) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "MISSING_KEY" }, { status: 500 });
  }

  const sp = req.nextUrl.searchParams;
  const name = (sp.get("name") || "").trim();
  const region = (sp.get("region") || "").trim();
  const address = (sp.get("address") || "").trim();
  const lat = parseFloat(sp.get("lat") || "");
  const lng = parseFloat(sp.get("lng") || "");
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  if (!name) {
    return NextResponse.json({ reason: "NO_NAME" });
  }

  // Tên lấy từ Google Maps nên chỉ cần tên + địa chỉ (hoặc khu vực) là khớp
  const textQuery = [name, address || region].filter(Boolean).join(", ");

  try {
    // --- Bước 1: tìm địa điểm ---
    const searchRes = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.photos",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "vi",
        regionCode: "VN",
        maxResultCount: 1,
        ...(hasCoords
          ? {
              locationBias: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: 1000,
                },
              },
            }
          : {}),
      }),
      cache: "no-store",
    });

    if (!searchRes.ok) {
      const body = await searchRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: searchRes.status === 429 ? "RATE_LIMIT" : `PLACES_${searchRes.status}`,
          message: body?.error?.message || "",
        },
        { status: searchRes.status === 429 ? 429 : 502 }
      );
    }

    const searchData = await searchRes.json();
    const place = searchData?.places?.[0];
    if (!place) {
      return NextResponse.json({ reason: "NOT_FOUND" });
    }

    // Kiểm tra khoảng cách để tránh trùng tên ở nơi khác
    if (hasCoords && place.location) {
      const d = distanceKm(lat, lng, place.location.latitude, place.location.longitude);
      if (d > MAX_DISTANCE_KM) {
        return NextResponse.json({
          reason: "TOO_FAR",
          message: `Kết quả cách tọa độ ${d.toFixed(1)} km`,
        });
      }
    }

    const photoName: string | undefined = place.photos?.[0]?.name;
    if (!photoName) {
      return NextResponse.json({ reason: "NO_PHOTO" });
    }

    // --- Bước 2: lấy link ảnh (skipHttpRedirect để nhận JSON chứa photoUri, không lộ API key) ---
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=900&skipHttpRedirect=true`,
      {
        headers: { "X-Goog-Api-Key": key },
        cache: "no-store",
      }
    );

    if (!photoRes.ok) {
      const body = await photoRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: photoRes.status === 429 ? "RATE_LIMIT" : `PLACES_${photoRes.status}`,
          message: body?.error?.message || "",
        },
        { status: photoRes.status === 429 ? 429 : 502 }
      );
    }

    const photoData = await photoRes.json();
    if (!photoData?.photoUri) {
      return NextResponse.json({ reason: "NO_PHOTO" });
    }

    return NextResponse.json({ imageUrl: photoData.photoUri });
  } catch (err: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}