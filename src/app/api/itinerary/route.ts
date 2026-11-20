// VỊ TRÍ FILE: src/app/api/itinerary/route.ts
// Nhờ Gemini soạn lịch trình du lịch An Giang từ các điểm đến người dùng đã chọn.
// Cần GEMINI_API_KEY trong .env.local (dùng chung với /api/place-image).
// Có thể đổi model bằng GEMINI_MODEL (mặc định gemini-2.5-flash).
import { NextResponse } from "next/server";

// Không khai báo runtime / dynamic / maxDuration vì dự án bật cacheComponents (POST luôn chạy theo từng yêu cầu)

interface InStop {
  id: string;
  name: string;
  region?: string;
  tab?: string;
  address?: string;
  hours?: string;
  ticket?: number;
  desc?: string;
  island?: boolean;
}

const str = (v: unknown, max: number): string => String(v ?? "").slice(0, max);

function cleanStops(v: unknown, max: number): InStop[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((x: any) => ({
    id: str(x?.id, 80),
    name: str(x?.name, 120),
    region: str(x?.region, 60),
    tab: str(x?.tab, 20),
    address: str(x?.address, 140),
    hours: str(x?.hours, 60),
    ticket: Number(x?.ticket) || 0,
    desc: str(x?.desc, 160),
    island: Boolean(x?.island),
  }));
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MISSING_KEY", message: "Chưa cấu hình GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const stops = cleanStops(body?.stops, 30);
  const candidates = cleanStops(body?.candidates, 30);
  if (stops.length === 0) {
    return NextResponse.json({ error: "NO_STOPS", message: "Chưa có điểm đến nào" }, { status: 400 });
  }

  const t = body?.trip || {};
  const days = Math.min(7, Math.max(1, Number(t.days) || 1));

  const prompt = `Bạn là hướng dẫn viên du lịch địa phương giàu kinh nghiệm tại tỉnh An Giang (Việt Nam, gồm cả Kiên Giang cũ: Phú Quốc, Hà Tiên, Rạch Giá, Kiên Hải, Thổ Châu).
Hãy soạn lịch trình ${days} ngày cho đoàn khách, viết bằng tiếng Việt, giọng thân thiện, ngắn gọn, thực tế.

THÔNG TIN CHUYẾN ĐI:
- Xuất phát từ: ${str(t.origin, 60)}; quay về điểm xuất phát: ${t.roundTrip ? "có" : "không"}
- Ngày đi: ${str(t.startDate, 20) || "chưa rõ"}
- Giờ bắt đầu mỗi ngày: ${str(t.dayStart, 8)}; giờ kết thúc: ${str(t.dayEnd, 8)}
- Nhịp độ: ${str(t.pace, 30)}
- Đoàn: ${Number(t.adults) || 1} người lớn, ${Number(t.children) || 0} trẻ em
- Phương tiện: ${str(t.vehicle, 40)} (${Number(t.vehicleCount) || 1} xe)
- Ngân sách dự kiến: ${Number(t.budget) || 0} đồng
- Tên chuyến: ${str(t.title, 120)}

CÁC ĐIỂM NGƯỜI DÙNG ĐÃ CHỌN (bắt buộc dùng hết, chỉ được sắp xếp thứ tự và chia ngày):
${JSON.stringify(stops)}

CÁC ĐỊA ĐIỂM GỢI Ý THÊM GẦN ĐÓ (quán ăn, nhà nghỉ... chỉ dùng để nhắc tên trong mealTip/stayTip, không đưa vào stops):
${JSON.stringify(candidates)}

QUY TẮC:
1. Mỗi placeId trong "stops" của kết quả PHẢI lấy từ danh sách điểm đã chọn, mỗi điểm xuất hiện đúng 1 lần, không bịa id.
2. Gom các điểm gần nhau vào cùng một ngày, hạn chế đi lại vòng vo. Điểm ở đảo (island=true) cần đi tàu/phà nên đặt liền nhau trong cùng ngày hoặc các ngày liên tiếp.
3. Chú ý giờ mở cửa; điểm ngoài trời nên đi sáng sớm hoặc chiều mát; chợ đêm, lễ hội đặt buổi tối.
4. Chia đều số điểm theo ${days} ngày theo nhịp độ đã chọn; ngày không có điểm thì để stops rỗng và gợi ý nghỉ ngơi.
5. "note" của mỗi điểm: 1 câu về điều nên làm/ăn/chụp ảnh hoặc lưu ý (tối đa 140 ký tự).
6. "mealTip" gợi ý bữa ăn trong ngày (có thể nhắc tên quán trong danh sách gợi ý thêm). "stayTip" gợi ý nơi nghỉ đêm (bỏ trống ở ngày cuối).
7. "tips" là 3-6 lời khuyên chung (thời tiết, tàu/phà, trang phục, an toàn, ứng xử văn minh).
8. Không bịa giá tiền hay số điện thoại.

CHỈ TRẢ VỀ JSON đúng dạng sau, không kèm chữ nào khác:
{"overview":"...","days":[{"day":1,"title":"...","summary":"...","stops":[{"placeId":"...","note":"..."}],"mealTip":"...","stayTip":"..."}],"tips":["..."]}`;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(55000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "NETWORK_ERROR", message: String(err).slice(0, 160) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `GEMINI_${res.status}`, message: errText.slice(0, 200) },
      { status: res.status === 429 ? 429 : 502 }
    );
  }

  const data: any = await res.json().catch(() => null);
  let text: string = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text || "")
    .join("")
    .trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    const plan = JSON.parse(text);
    return NextResponse.json({ ok: true, plan });
  } catch {
    return NextResponse.json(
      { error: "BAD_AI_JSON", message: "Gemini trả về dữ liệu không đọc được, hãy thử lại" },
      { status: 502 }
    );
  }
}