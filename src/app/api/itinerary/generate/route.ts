import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { optimizeRouteOrder, estimateTravelTimeMinutes } from "@/lib/geo";

const plannerRequestSchema = z.object({
  startPoint: z.string().min(2),
  startLat: z.number(),
  startLng: z.number(),
  targetRegion: z.string(),
  startDate: z.string(),
  daysCount: z.number().int().min(1).max(7),
  dailyStartTime: z.string().default("07:00"),
  transportMode: z.enum(["MOTORBIKE", "CAR", "WALKING"]).default("MOTORBIKE"),
  budget: z.number().min(0),
  peopleCount: z.number().int().min(1),
  preferences: z.array(z.string()).min(1),
  approvedPlaces: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      address: z.string(),
      openingHours: z.string(),
      ticketPrice: z.number(),
      tags: z.array(z.string()),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = plannerRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu đầu vào không hợp lệ", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      startLat,
      startLng,
      daysCount,
      transportMode,
      peopleCount,
      preferences,
      approvedPlaces,
    } = parsed.data;

    // 1. Lọc các địa điểm đã được Admin duyệt khớp với sở thích người dùng
    const matchedPlaces = approvedPlaces.filter((place) =>
      place.tags.some((t) => preferences.includes(t))
    );
    const candidatePool = matchedPlaces.length > 0 ? matchedPlaces : approvedPlaces;

    // 2. Tối ưu thứ tự di chuyển bằng Nearest Neighbor TSP để tránh đi vòng lại
    const optimizedStops = optimizeRouteOrder(startLat, startLng, candidatePool);

    // 3. Phân bổ khung giờ thực tế theo từng ngày
    const slotsTemplate = [
      { startTime: "07:00", endTime: "08:00", type: "BREAKFAST", label: "Ăn sáng đặc sản địa phương" },
      { startTime: "08:00", endTime: "10:00", type: "VISIT", label: "Tham quan điểm 1" },
      { startTime: "10:00", endTime: "11:30", type: "VISIT", label: "Tham quan điểm 2" },
      { startTime: "11:30", endTime: "13:30", type: "LUNCH", label: "Ăn trưa & Nghỉ ngơi" },
      { startTime: "13:30", endTime: "15:30", type: "VISIT", label: "Khám phá điểm 3" },
      { startTime: "16:00", endTime: "17:00", type: "CAFE", label: "Thưởng thức cà phê & Ngắm cảnh" },
      { startTime: "17:00", endTime: "18:00", type: "REST", label: "Kết thúc hành trình trong ngày" },
    ];

    let stopCursor = 0;
    let totalCost = 0;

    const days = Array.from({ length: daysCount }, (_, dayIdx) => {
      const dayNumber = dayIdx + 1;
      const stops = slotsTemplate.map((slot, idx) => {
        if (slot.type === "VISIT" && stopCursor < optimizedStops.length) {
          const place = optimizedStops[stopCursor++];
          const travelMin = estimateTravelTimeMinutes(place.distanceFromPrevKm, transportMode);
          const cost = place.ticketPrice * peopleCount;
          totalCost += cost;

          return {
            orderIndex: idx + 1,
            startTime: slot.startTime,
            endTime: slot.endTime,
            activityType: slot.type,
            title: `Tham quan ${place.name}`,
            address: place.address,
            openingHours: place.openingHours,
            distanceFromPrevKm: place.distanceFromPrevKm,
            travelTimeMinutes: travelMin,
            estimatedCost: cost,
            latitude: place.latitude,
            longitude: place.longitude,
            destinationId: place.id,
          };
        }

        const mealCost =
          slot.type === "BREAKFAST"
            ? 45000 * peopleCount
            : slot.type === "LUNCH"
            ? 120000 * peopleCount
            : slot.type === "CAFE"
            ? 40000 * peopleCount
            : 0;
        totalCost += mealCost;

        return {
          orderIndex: idx + 1,
          startTime: slot.startTime,
          endTime: slot.endTime,
          activityType: slot.type,
          title: slot.label,
          address: parsed.data.targetRegion,
          openingHours: "06:00 - 22:00",
          distanceFromPrevKm: 1.2,
          travelTimeMinutes: 5,
          estimatedCost: mealCost,
          latitude: startLat,
          longitude: startLng,
          destinationId: null,
        };
      });

      return { dayNumber, stops };
    });

    return NextResponse.json({
      itinerary: {
        ...parsed.data,
        totalEstimatedCost: totalCost,
        days,
        aiVerifiedNote:
          "Lịch trình chỉ sử dụng các địa điểm đã được Quản trị viên kiểm duyệt trong hệ thống.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi máy chủ khi tạo lịch trình thông minh." },
      { status: 500 }
    );
  }
}