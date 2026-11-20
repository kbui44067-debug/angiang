import os

files = {
    ".env.example": """DATABASE_URL="postgresql://postgres:password@localhost:5432/angiang_travel?schema=public"
JWT_SECRET="replace-with-strong-secret-key-at-least-32-chars"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
GOOGLE_PLACES_SERVER_API_KEY=""
GOOGLE_ROUTES_SERVER_API_KEY=""
GEMINI_API_KEY=""
""",

    "prisma/schema.prisma": """generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum RoleName {
  USER
  EDITOR
  ADMIN
}

model Role {
  id          String   @id @default(cuid())
  name        RoleName @unique
  users       User[]
  @@map("roles")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  fullName     String
  isLocked     Boolean  @default(false)
  roleId       String
  role         Role     @relation(fields: [roleId], references: [id])
  createdAt    DateTime @default(now())
  @@map("users")
}

model Region {
  id              String        @id @default(cuid())
  name            String
  slug            String        @unique
  description     String
  centerLatitude  Float
  centerLongitude Float
  destinations    Destination[]
  @@map("regions")
}

model Destination {
  id              String   @id @default(cuid())
  name            String
  nameEn          String?
  slug            String   @unique
  shortDesc       String
  detailedContent String   @db.Text
  address         String
  latitude        Float
  longitude       Float
  openingHours    String?
  ticketPrice     Int      @default(0)
  rating          Float    @default(0)
  reviewCount     Int      @default(0)
  isVisible       Boolean  @default(true)
  isDemo          Boolean  @default(false)
  regionId        String
  region          Region   @relation(fields: [regionId], references: [id])
  createdAt       DateTime @default(now())
  @@index([latitude, longitude])
  @@map("destinations")
}
""",

    "src/lib/geo.ts": """export interface GeoPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  openingHours?: string;
  ticketPrice?: number;
  address?: string;
  tags?: string[];
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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

export function estimateTravelTimeMinutes(
  distanceKm: number,
  mode: "MOTORBIKE" | "CAR" | "WALKING" = "MOTORBIKE"
): number {
  const speedKmh = mode === "WALKING" ? 5 : mode === "MOTORBIKE" ? 35 : 45;
  const roadDistance = distanceKm * 1.25;
  return Math.max(5, Math.round((roadDistance / speedKmh) * 60));
}

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
""",

    "src/app/api/places/nearby/route.ts": """import { NextRequest, NextResponse } from "next/server";
import { calculateHaversineDistanceKm } from "@/lib/geo";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") || 10.0125);
  const lng = Number(searchParams.get("lng") || 105.0809);
  const radiusKm = Number(searchParams.get("radiusKm") || 5);

  return NextResponse.json({
    meta: {
      userLocation: { lat, lng },
      radiusKm,
      googleApiConfigured: Boolean(process.env.GOOGLE_PLACES_SERVER_API_KEY),
    },
    sampleDistanceKm: calculateHaversineDistanceKm(lat, lng, 10.0152, 105.0812),
  });
}
"""
}

for filepath, content in files.items():
    os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Đã tạo: {filepath}")

print("Hoàn tất tạo cấu trúc Backend & Prisma!")