export interface GeoPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  openingHours?: string;
  ticketPrice?: number;
  address?: string;
  tags?: string[];
}

/**
 * Tính khoảng cách đường chim bay (km) giữa 2 tọa độ GPS bằng công thức Haversine
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Ước tính thời gian di chuyển (phút) theo phương tiện
 */
export function estimateTravelTimeMinutes(
  distanceKm: number,
  mode: "MOTORBIKE" | "CAR" | "WALKING" = "MOTORBIKE"
): number {
  const speedKmh = mode === "WALKING" ? 5 : mode === "MOTORBIKE" ? 35 : 45;
  // Nhân hệ số đường thực tế 1.25 so với đường chim bay
  const roadDistance = distanceKm * 1.25;
  return Math.max(5, Math.round((roadDistance / speedKmh) * 60));
}

/**
 * Thuật toán Nearest Neighbor TSP: Sắp xếp thứ tự điểm tham quan tối ưu
 * hạn chế di chuyển vòng lại từ điểm xuất phát
 */
export function optimizeRouteOrder<T extends GeoPoint>(
  startLat: number,
  startLng: number,
  places: T[]
): Array<T & { distanceFromPrevKm: number }> {
  const unvisited = [...places];
  const ordered: Array<T & { distanceFromPrevKm: number }> = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateHaversineDistanceKm(
        currentLat,
        currentLng,
        unvisited[i].latitude,
        unvisited[i].longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    const nextStop = unvisited.splice(nearestIndex, 1)[0];
    ordered.push({
      ...nextStop,
      distanceFromPrevKm: minDistance,
    });
    currentLat = nextStop.latitude;
    currentLng = nextStop.longitude;
  }

  return ordered;
}
export interface RoadRouteInfo {
  distanceKm: number;
  durationMinutes: number;
  isRealRoad: boolean;
}

/**
 * Gọi OSRM Table API (Miễn phí, không cần API Key)
 * Tính quãng đường lái xe thực tế & thời gian di chuyển từ 1 vị trí đến nhiều địa điểm cùng lúc
 */
export async function fetchOsrmBatchDistances(
  userLat: number,
  userLng: number,
  destinations: Array<{ id: string; latitude: number; longitude: number }>
): Promise<Record<string, RoadRouteInfo>> {
  if (destinations.length === 0) return {};

  try {
    // OSRM quy định thứ tự tọa độ là: Kinh độ (longitude),Vĩ độ (latitude)
    const coordsList = [
      `${userLng},${userLat}`,
      ...destinations.map((d) => `${d.longitude},${d.latitude}`),
    ].join(";");

    // sources=0 nghĩa là lấy tọa độ đầu tiên (vị trí người dùng) làm gốc tính đến tất cả điểm còn lại
    const url = `https://router.project-osrm.org/table/v1/driving/${coordsList}?sources=0&annotations=distance,duration`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.distances?.[0] || !data.durations?.[0]) {
      return {};
    }

    const resultMap: Record<string, RoadRouteInfo> = {};
    destinations.forEach((dest, idx) => {
      // Cộng 1 vì vị trí số 0 trong mảng là tọa độ của người dùng
      const distMeters = data.distances[0][idx + 1];
      const durSeconds = data.durations[0][idx + 1];

      if (typeof distMeters === "number" && typeof durSeconds === "number") {
        resultMap[dest.id] = {
          distanceKm: Number((distMeters / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round(durSeconds / 60)),
          isRealRoad: true,
        };
      }
    });

    return resultMap;
  } catch (error) {
    console.warn("Không thể kết nối OSRM, tự động dùng khoảng cách dự phòng:", error);
    return {};
  }
}