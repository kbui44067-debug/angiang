// VỊ TRÍ FILE: src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";
import { diffState, applyStateDelta, SharedState } from "../lib/sync";
import {
  MapPin,
  Navigation,
  Search,
  Star,
  Calendar,
  BookOpen,
  Utensils,
  Bed,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Printer,
  Eye,
  EyeOff,
  Clock,
  Phone,
  ExternalLink,
  ChevronRight,
  LogOut,
  Lock,
  Compass,
  X,
  Upload,
  Tag,
  Map,
  Mic,
  Volume2,
  PhoneCall,
  Heart,
  Fuel,
  Ship,
  Award,
  MessageSquarePlus,
  Save,
  Bookmark,
  Check,
  Menu,
} from "lucide-react";

// --- KIỂU DỮ LIỆU ---
type FunctionalTab =
  | "HOME"
  | "THAM_QUAN"
  | "BAN_DO"
  | "AM_THUC"
  | "NHA_NGHI"
  | "MUA_SAM"
  | "LE_HOI"
  | "OCOP"
  | "HANH_TRINH"
  | "CAM_NANG"
  | "ADMIN";

interface RegionItem {
  id: string;
  name: string;
  displayLabel: string;
  isIsland?: boolean;
}

interface PlaceItem {
  id: string;
  name: string;
  englishName?: string;
  region: string;
  tab: FunctionalTab;
  subCategory: string;
  badgeIcon: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  ticketPrice: number;
  priceLevel: string;
  openingHours: string;
  phone: string;
  shortDesc: string;
  culturalHistory: string;
  behaviorNotes?: string;
  pageSource?: number;
  awardBadge?: string;
  imageUrl: string;
  tags: string[];
  isVisible: boolean;
  isFeatured?: boolean; // Admin đánh dấu ⭐ = địa điểm nổi tiếng, hiện ở menu chính
}

interface UserReviewItem {
  id: string;
  placeId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface SavedTripItem {
  id: string;
  title: string;
  createdAt: string;
  owner: string;
  plannerDays: number;
  adultCount: number;
  childCount: number;
  vehicleType: "personal_car" | "motorbike" | "rental_car";
  vehicleCount: number;
  destIds: string[];
  roadKm: number;
  waterKm: number;
  totalCost: number;
  perPersonCost: number;
  // Các lựa chọn bổ sung của bộ lập hành trình 4 bước (chuyến cũ có thể không có)
  originName?: string;
  startDate?: string;
  dayStartTime?: string;
  dayEndTime?: string;
  pace?: "slow" | "normal" | "busy";
  roundTrip?: boolean;
  ai?: AiTripPlan;
  cost?: {
    fuelConsumption: number;
    fuelPrice: number;
    tollFees: number;
    parkingFees: number;
    foodPerPersonDay: number;
    roomPricePerNight: number;
    roomCount: number;
    funShopCost: number;
    ticketOverride: number | null;
    contingencyPercent: number;
    expectedBudget: number;
  };
}

type HubType = "ferry" | "bus" | "airport";

interface TransitHub {
  id: string;
  name: string;
  type: HubType;
  lat: number;
  lng: number;
  note: string;
}

interface UserAccount {
  username: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
}

// --- TIỆN ÍCH TÌM KIẾM TIẾNG VIỆT KHÔNG DẤU ---
function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function matchesVietnameseSearch(text: string | undefined | null, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!text) return false;
  return removeVietnameseTones(text).includes(removeVietnameseTones(query));
}

// Ảnh mặc định gắn tạm cho địa điểm chưa có ảnh thật
const DEFAULT_PLACE_IMAGE_URL =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80";

// Địa điểm "chưa có ảnh" = để trống hoặc vẫn đang dùng ảnh mặc định
function isMissingImage(p: { imageUrl?: string | null }): boolean {
  const url = (p.imageUrl || "").trim();
  return !url || url === DEFAULT_PLACE_IMAGE_URL;
}

// Hàng ngang cuộn được: vuốt bằng ngón tay (điện thoại) hoặc nhấn giữ chuột rồi kéo (máy tính)
function HorizontalDragScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  return (
    <div
      ref={ref}
      onMouseDown={(e) => {
        if (!ref.current) return;
        drag.current = {
          down: true,
          startX: e.pageX,
          startScroll: ref.current.scrollLeft,
          moved: false,
        };
      }}
      onMouseMove={(e) => {
        const d = drag.current;
        if (!d.down || !ref.current) return;
        const dx = e.pageX - d.startX;
        if (Math.abs(dx) > 5) d.moved = true;
        if (d.moved) ref.current.scrollLeft = d.startScroll - dx;
      }}
      onMouseUp={() => (drag.current.down = false)}
      onMouseLeave={() => (drag.current.down = false)}
      // Nếu vừa kéo thì không coi là bấm vào thẻ (tránh mở nhầm địa điểm)
      onClickCapture={(e) => {
        if (drag.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          drag.current.moved = false;
        }
      }}
      className="flex gap-3 overflow-x-auto pb-3 pt-1 -mx-1 px-1 snap-x snap-proximity cursor-grab active:cursor-grabbing select-none [scrollbar-width:thin]"
    >
      <style>{`
        @keyframes agCardIn {
          from { opacity: 0; transform: translateX(24px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        .ag-card-in { animation: agCardIn 0.45s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .ag-card-in { animation: none; }
        }
      `}</style>
      {children}
    </div>
  );
}

// --- MENU CHÍNH: ĐỊA ĐIỂM NỔI TIẾNG (Admin đánh dấu ⭐) ---
// Mặc định hiện địa điểm nổi tiếng của 4 khu vực này (mỗi khu vực 1 phần riêng); nút "Địa điểm gần đây" tìm theo GPS.
const FEATURED_REGION_GROUPS: { name: string }[] = [
  { name: "Phú Quốc" },
  { name: "Hà Tiên" },
  { name: "Rạch Giá" },
  { name: "Long Xuyên" },
];
const DEFAULT_FEATURED_REGIONS = FEATURED_REGION_GROUPS.map((g) => g.name);

// Thứ tự ưu tiên của các nút "Chọn khu vực khám phá": các khu vực này lên đầu, còn lại giữ nguyên thứ tự cũ.
const REGION_CHIP_PRIORITY = ["Phú Quốc", "Hà Tiên", "Rạch Giá", "Long Xuyên", "Châu Đốc"].map(
  (n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
);

function FeaturedPlacesHome({
  places,
  userLocation,
  isAdmin,
  onOpenPlace,
  onLocateMe,
}: {
  places: PlaceItem[];
  userLocation: { lat: number; lng: number; label: string };
  isAdmin: boolean;
  onOpenPlace: (id: string) => void;
  onLocateMe: () => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"default" | "nearby">("default");
  const [locating, setLocating] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string>("");

  const defaultKeys = DEFAULT_FEATURED_REGIONS.map(normalizeAreaName);
  const featured = places.filter((p) => p.isVisible && p.isFeatured);

  const sorted = (
    mode === "nearby"
      ? featured
      : featured.filter((p) => defaultKeys.includes(normalizeAreaName(p.region)))
  )
    .map((p) => ({
      place: p,
      km: haversineKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude),
    }))
    .sort((x, y) =>
      mode === "nearby"
        ? x.km - y.km
        : defaultKeys.indexOf(normalizeAreaName(x.place.region)) -
            defaultKeys.indexOf(normalizeAreaName(y.place.region)) ||
          normalizeRating(y.place.rating) - normalizeRating(x.place.rating) ||
          y.place.reviewCount - x.place.reviewCount
    );

  // Chế độ mặc định: tách thành 4 phần theo khu vực
  const groups = FEATURED_REGION_GROUPS.map((g) => ({
    ...g,
    items: sorted.filter(
      ({ place }) => normalizeAreaName(place.region) === normalizeAreaName(g.name)
    ),
  })).filter((g) => g.items.length > 0);

  const renderCard = (place: PlaceItem, km: number, idx: number) => (
    <button
      key={place.id}
      type="button"
      onClick={() => onOpenPlace(place.id)}
      style={{ animationDelay: `${Math.min(idx, 8) * 70}ms` }}
      className="ag-card-in group flex flex-col text-left rounded-2xl bg-white border border-slate-200 hover:border-teal-400 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer w-72 sm:w-80 shrink-0 snap-start overflow-hidden"
    >
      <div className="relative h-40 sm:h-44 overflow-hidden bg-gradient-to-br from-teal-200 to-sky-200">
        {place.imageUrl && (
          <img
            src={place.imageUrl}
            alt={place.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
        {mode === "nearby" && idx === 0 && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-amber-400 text-xs font-extrabold text-amber-950 shadow">
            Gần bạn nhất
          </span>
        )}
        <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-extrabold text-amber-600 shadow">
          ★ {normalizeRating(place.rating)}
        </span>
        <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-teal-600/90 backdrop-blur text-xs font-bold text-white shadow">
          📍 {formatApproxKm(km)} từ bạn
        </span>
      </div>
      <div className="min-w-0 p-3.5 space-y-1">
        <p className="font-bold text-base text-slate-900 line-clamp-2 transition-colors group-hover:text-teal-700">
          {place.name}
        </p>
        <p className="text-xs sm:text-sm text-slate-500 truncate">
          {place.region} • {place.subCategory} {place.badgeIcon}
        </p>
        {place.shortDesc && (
          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">{place.shortDesc}</p>
        )}
      </div>
    </button>
  );

  const handleNearby = async () => {
    setLocating(true);
    setGpsNotice("");
    const ok = await onLocateMe();
    setMode("nearby");
    setLocating(false);
    if (!ok) {
      setGpsNotice(
        "Chưa lấy được GPS của bạn (hãy cho phép trình duyệt truy cập vị trí). Đang dùng vị trí mặc định."
      );
    }
  };

  if (featured.length === 0) {
    if (!isAdmin) return null;
    return (
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-3xl shadow-md border border-dashed border-amber-300 text-sm text-slate-600">
        ⭐ Chưa có địa điểm nổi tiếng nào. Vào <strong>Admin → mục 3 (Danh sách địa điểm)</strong> rồi bấm
        ngôi sao ở địa điểm muốn đánh dấu. Mặc định menu chính chỉ hiện địa điểm nổi tiếng thuộc{" "}
        {DEFAULT_FEATURED_REGIONS.join(", ")}.
      </div>
    );
  }

  return (
    <div className="bg-white/85 backdrop-blur-md p-5 md:p-6 rounded-3xl shadow-xl border border-white space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
            ⭐ Địa điểm nổi tiếng{mode === "nearby" ? " gần bạn" : " của An Giang"}
          </h2>
          <p className="text-xs text-slate-500">
            {mode === "nearby"
              ? `Sắp xếp theo khoảng cách gần bạn nhất • Vị trí của bạn: ${userLocation.label}`
              : `Nổi bật nhất tại ${DEFAULT_FEATURED_REGIONS.join(" • ")}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("default");
              setGpsNotice("");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
              mode === "default"
                ? "bg-teal-600 text-white border-teal-700 shadow-sm"
                : "bg-white hover:bg-teal-50 text-slate-700 border-slate-300"
            }`}
          >
            ⭐ Nổi bật nhất
          </button>
          <button
            type="button"
            onClick={handleNearby}
            disabled={locating}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 disabled:opacity-70 ${
              mode === "nearby"
                ? "bg-teal-600 text-white border-teal-700 shadow-sm"
                : "bg-white hover:bg-teal-50 text-slate-700 border-slate-300"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            {locating ? "Đang lấy GPS..." : "Địa điểm gần đây"}
          </button>
        </div>
      </div>

      {gpsNotice && (
        <p className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">
          {gpsNotice}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="p-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
          Chưa có địa điểm nổi tiếng nào ở {DEFAULT_FEATURED_REGIONS.join(", ")}. Bấm{" "}
          <strong>&quot;Địa điểm gần đây&quot;</strong> để xem các nơi nổi tiếng gần bạn.
        </p>
      ) : (
        mode === "nearby" ? (
          <HorizontalDragScroll key="nearby">
            {sorted.map(({ place, km }, idx) => renderCard(place, km, idx))}
          </HorizontalDragScroll>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.name} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-extrabold text-teal-900">
                    {g.name}
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {g.items.length} địa điểm
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-teal-200 to-transparent" />
                </div>
                <HorizontalDragScroll key={`default-${g.name}`}>
                  {g.items.map(({ place, km }, idx) => renderCard(place, km, idx))}
                </HorizontalDragScroll>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// Giá phòng tham khảo của nhà nghỉ (dữ liệu cũ nhập trước đây có thể đang là "Miễn phí" -> coi như chưa có giá)
function getStayPriceText(place: { priceLevel?: string }): string {
  const t = (place.priceLevel || "").trim();
  return t && t !== "Miễn phí" ? normalizePriceText(t) : "Đang cập nhật";
}

// Định dạng 1 số tiền: 100000 -> "100.000 VND"
function formatVND(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString("vi-VN")} VND`;
}

// Chuẩn hóa mọi kiểu nhập giá về dạng "100.000 VND" / "35.000 - 55.000 VND/tô".
// Hiểu: "100-500 N đ", "1-100.000 đ", "35.000đ - 55.000đ/tô", "50k", "1,5 triệu", "100000"...
// Số nhỏ hơn 1.000 mà không ghi đơn vị được hiểu là nghìn đồng (100 -> 100.000 VND).
function normalizePriceText(raw?: string | null): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (!/\d/.test(text)) return text; // "Theo thực đơn", "Đang cập nhật"...

  const re = /(\d[\d.,]*)(?:\s*(nghìn|ngàn|triệu|tr|k|n|m)(?![\p{L}]))?/giu;
  const tokens: { value: number; mult: number }[] = [];
  let firstIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (firstIndex < 0) firstIndex = m.index;
    const numStr = m[1].replace(/[.,]+$/, "");
    const value = /^\d{1,3}([.,]\d{3})+$/.test(numStr)
      ? parseInt(numStr.replace(/[.,]/g, ""), 10)
      : parseFloat(numStr.replace(",", "."));
    const unit = (m[2] || "").toLowerCase();
    const mult = ["triệu", "tr", "m"].includes(unit) ? 1000000 : unit ? 1000 : 0;
    if (!Number.isNaN(value)) tokens.push({ value, mult });
  }
  if (tokens.length === 0) return text;

  // Khoảng giá kiểu "100-500 N": đơn vị ở số cuối áp dụng cho cả số đứng trước
  let carry = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].mult) carry = tokens[i].mult;
    else if (carry) tokens[i].mult = carry;
  }

  const amounts = tokens.map((t) => {
    let v = t.value * (t.mult || 1);
    if (!t.mult && v > 0 && v < 1000) v *= 1000;
    return Math.round(v).toLocaleString("vi-VN");
  });

  const prefix = text.slice(0, firstIndex).trim();
  const suffixMatch = text.match(/\/\s*[\p{L}\d ]+$/u);
  const suffix = suffixMatch ? suffixMatch[0].replace(/\s+/g, "") : "";

  return `${prefix ? prefix + " " : ""}${amounts.join(" - ")} VND${suffix}`;
}

// Số tiền nhập dạng số: dưới 1.000 được hiểu là nghìn đồng (300 -> 300.000)
function normalizeAmountVND(value: number): number {
  const v = Number(value) || 0;
  return v > 0 && v < 1000 ? v * 1000 : Math.round(v);
}

// Giá món ăn hiển thị: ưu tiên khoảng giá nhập tay, không có thì dùng đơn giá trung bình
function getFoodPriceText(place: { priceLevel?: string; ticketPrice?: number }): string {
  const t = normalizePriceText(place.priceLevel);
  if (t) return t;
  return Number(place.ticketPrice) > 0 ? formatVND(Number(place.ticketPrice)) : "Theo thực đơn";
}

// --- COMPONENT THẺ TỔNG QUAN ĐỊA LÝ AN GIANG & GIỚI THIỆU ỨNG DỤNG ---
function AnGiangOverviewCard({ onSelectRegion }: { onSelectRegion: (regName: string) => void }) {
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-white space-y-3.5 text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-700 text-white font-extrabold flex items-center justify-center text-xs shadow">
            AG
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Tổng quan Địa lý An Giang Mới
            </h3>
            <p className="text-[11px] text-slate-500">
              Đầu nguồn Cửu Long • Duyên hải & 3 Đặc khu Hải đảo
            </p>
          </div>
        </div>
        <span className="text-[11px] bg-teal-50 text-teal-900 font-bold px-2.5 py-1 rounded-full border border-teal-200">
          14 phường • 85 xã • 3 đặc khu
        </span>
      </div>

      <div className="relative bg-gradient-to-br from-emerald-50 via-teal-50/50 to-sky-50 rounded-2xl p-3 border border-emerald-100/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-teal-900">
          <span>Bản đồ hành chính & Tuyến đảo</span>
          <span className="text-emerald-700 font-normal">Biên giới Campuchia ⇄ Vịnh Thái Lan</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => onSelectRegion("Phú Quốc")}
            className="p-2 rounded-xl bg-white hover:bg-emerald-50 border border-teal-200 text-left transition shadow-2xs group cursor-pointer"
          >
            <span className="font-bold text-teal-950 block group-hover:text-teal-700">
              🏝️ Đặc khu Phú Quốc
            </span>
            <span className="text-[10px] text-slate-500 block">Thiên đường biển đảo</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectRegion("Rạch Giá")}
            className="p-2 rounded-xl bg-white hover:bg-emerald-50 border border-teal-200 text-left transition shadow-2xs group cursor-pointer"
          >
            <span className="font-bold text-teal-950 block group-hover:text-teal-700">
              🏙️ TP. Rạch Giá
            </span>
            <span className="text-[10px] text-slate-500 block">Đô thị lấn biển sầm uất</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectRegion("Châu Đốc")}
            className="p-2 rounded-xl bg-white hover:bg-emerald-50 border border-teal-200 text-left transition shadow-2xs group cursor-pointer"
          >
            <span className="font-bold text-teal-950 block group-hover:text-teal-700">
              ⛰️ Châu Đốc - Bảy Núi
            </span>
            <span className="text-[10px] text-slate-500 block">Tâm linh Miếu Bà Núi Sam</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-0.5">
          <span className="text-slate-400 text-[11px] font-medium block">Diện tích tự nhiên</span>
          <span className="font-extrabold text-slate-900 text-sm">~9.889 km²</span>
          <span className="text-[10px] text-emerald-700 block">Đất liền, rừng ngập & hải đảo</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-0.5">
          <span className="text-slate-400 text-[11px] font-medium block">Quy mô dân số</span>
          <span className="font-extrabold text-slate-900 text-sm">~3.75 triệu người</span>
          <span className="text-[10px] text-slate-500 block">Kinh • Khmer • Chăm • Hoa</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <span>Tổng thể: 14 phường • 85 xã • 3 đặc khu</span>
        <span className="font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
          APEC 2027
        </span>
      </div>
    </div>
  );
}

// --- COMPONENT CHỌN KHU VỰC CÓ TÌM KIẾM NHANH (GÕ VÀI CHỮ ĐẦU KHÔNG DẤU/CÓ DẤU) ---
function SearchableRegionSelect({
  regions,
  places,
  value,
  onChange,
  includeAllOption = false,
  allOptionLabel = "Tất cả khu vực",
  variant = "sidebar",
}: {
  regions: RegionItem[];
  places: PlaceItem[];
  value: string;
  onChange: (val: string) => void;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  variant?: "sidebar" | "admin";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const regionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    places.forEach((p) => {
      if (p.isVisible) map[p.region] = (map[p.region] || 0) + 1;
    });
    return map;
  }, [places]);

  const totalVisible = useMemo(() => places.filter((p) => p.isVisible).length, [places]);

  // Sắp xếp theo số thứ tự 1-102; khu vực ngoài danh sách xếp cuối, giữ thứ tự cũ
  const orderedRegions = useMemo(() => {
    return regions
      .map((reg, idx) => ({ reg, idx, no: getAreaNumber(reg.name) }))
      .sort((a, b) => (a.no ?? 1000 + a.idx) - (b.no ?? 1000 + b.idx))
      .map((x) => x.reg);
  }, [regions]);

  const filteredRegions = useMemo(() => {
    const q = removeVietnameseTones(keyword);
    if (!q) return orderedRegions;

    const startsWithList: RegionItem[] = [];
    const includesList: RegionItem[] = [];

    orderedRegions.forEach((reg) => {
      const cleanName = removeVietnameseTones(reg.name);
      const cleanLabel = removeVietnameseTones(reg.displayLabel);
      const initials = cleanName
        .split(/\s+/)
        .map((w) => w[0])
        .join("");
      const no = getAreaNumber(reg.name);

      if (/^\d+$/.test(q) && no !== undefined) {
        // Gõ số (VD: 83) thì tìm theo số thứ tự
        if (String(no) === q) startsWithList.push(reg);
        else if (String(no).startsWith(q)) includesList.push(reg);
      } else if (
        cleanName.startsWith(q) ||
        cleanLabel.startsWith(q) ||
        initials.startsWith(q)
      ) {
        startsWithList.push(reg);
      } else if (cleanName.includes(q) || cleanLabel.includes(q)) {
        includesList.push(reg);
      }
    });

    return [...startsWithList, ...includesList];
  }, [orderedRegions, keyword]);

  const selectedDisplay = useMemo(() => {
    if (includeAllOption && value === "ALL") {
      return `${allOptionLabel} (${totalVisible})`;
    }
    const found = regions.find((r) => r.name === value);
    const count = regionCounts[value] || 0;
    return found
      ? variant === "sidebar"
        ? `${found.displayLabel}(${count})`
        : found.name
      : value || "Chọn khu vực";
  }, [includeAllOption, value, allOptionLabel, totalVisible, regions, regionCounts, variant]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setKeyword("");
        }}
        className={
          variant === "sidebar"
            ? "w-full bg-[#F4F6F8] hover:bg-white text-slate-800 font-bold text-sm px-4 py-2 rounded-full shadow-md border border-slate-300 flex items-center justify-between cursor-pointer transition"
            : "w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 font-semibold flex items-center justify-between cursor-pointer"
        }
      >
        <span className="truncate">{selectedDisplay}</span>
        <span className="text-slate-600 font-bold text-xs ml-2">^</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden min-w-[230px]">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredRegions.length > 0) {
                    e.preventDefault();
                    onChange(filteredRegions[0].name);
                    setIsOpen(false);
                  }
                }}
                placeholder="Tìm Kiếm)"
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 text-xs">
            {includeAllOption &&
              (!keyword.trim() || matchesVietnameseSearch(allOptionLabel, keyword)) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("ALL");
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 font-bold flex items-center justify-between hover:bg-teal-50 transition ${
                    value === "ALL" ? "bg-teal-600 text-white hover:bg-teal-700" : "text-slate-800"
                  }`}
                >
                  <span>{allOptionLabel}</span>
                  <span className="text-[11px] opacity-80">({totalVisible})</span>
                </button>
              )}

            {filteredRegions.length === 0 ? (
              <div className="p-3 text-center text-slate-400">
                Không tìm thấy khu vực &quot;{keyword}&quot;
              </div>
            ) : (
              filteredRegions.map((reg) => {
                const count = regionCounts[reg.name] || 0;
                const active = value === reg.name;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => {
                      onChange(reg.name);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-teal-50 transition ${
                      active
                        ? "bg-teal-600 text-white font-bold hover:bg-teal-700"
                        : "text-slate-700 font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {getAreaNumber(reg.name) !== undefined && (
                        <span
                          className={`w-7 shrink-0 text-right tabular-nums text-[11px] font-bold ${
                            active ? "text-white/80" : "text-slate-400"
                          }`}
                        >
                          {getAreaNumber(reg.name)}.
                        </span>
                      )}
                      <span className="truncate">
                        {variant === "sidebar" ? reg.displayLabel : reg.name}
                      </span>
                    </span>
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- CÔNG THỨC HAVERSINE DỰ PHÒNG ---
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// Đưa điểm về thang 0-5, làm tròn 1 chữ số (VD: 46237 -> 4.6)
function normalizeRating(value: number): number {
  let r = Number(value) || 0;
  while (r > 5) r /= 10;
  return Math.round(r * 10) / 10;
}

// --- 102 XÃ / PHƯỜNG / ĐẶC KHU CỦA AN GIANG (dùng để dọn địa điểm nằm ngoài tỉnh) ---
const AN_GIANG_AREAS: string[] = [
  "An Phú", "Vĩnh Hậu", "Nhơn Hội", "Khánh Bình", "Phú Hữu", "Tân An", "Châu Phong",
  "Vĩnh Xương", "Phú Tân", "Phú An", "Bình Thạnh Đông", "Chợ Vàm", "Hòa Lạc", "Phú Lâm",
  "Châu Phú", "Mỹ Đức", "Vĩnh Thạnh Trung", "Bình Mỹ", "Thạnh Mỹ Tây", "An Cư", "Núi Cấm",
  "Ba Chúc", "Tri Tôn", "Ô Lâm", "Cô Tô", "Vĩnh Gia", "An Châu", "Bình Hòa", "Cần Đăng",
  "Vĩnh Hanh", "Vĩnh An", "Chợ Mới", "Cù Lao Giêng", "Hội An", "Long Điền", "Nhơn Mỹ",
  "Long Kiến", "Thoại Sơn", "Óc Eo", "Định Mỹ", "Phú Hòa", "Vĩnh Trạch", "Tây Phú",
  "Vĩnh Bình", "Vĩnh Thuận", "Vĩnh Phong", "Vĩnh Hòa", "U Minh Thượng", "Đông Hòa",
  "Tân Thạnh", "Đông Hưng", "An Minh", "Vân Khánh", "Tây Yên", "Đông Thái", "An Biên",
  "Định Hòa", "Gò Quao", "Vĩnh Hòa Hưng", "Vĩnh Tuy", "Giồng Riềng", "Thạnh Hưng",
  "Long Thạnh", "Hòa Hưng", "Ngọc Chúc", "Hòa Thuận", "Tân Hội", "Tân Hiệp", "Thạnh Đông",
  "Thạnh Lộc", "Châu Thành", "Bình An", "Hòn Đất", "Sơn Kiên", "Mỹ Thuận", "Hòa Điền",
  "Kiên Lương", "Giang Thành", "Vĩnh Điều", "Mỹ Hòa Hưng", "Bình Giang", "Bình Sơn",
  "Hòn Nghệ", "Sơn Hải", "Tiên Hải", "Long Xuyên", "Bình Đức", "Mỹ Thới", "Châu Đốc",
  "Vĩnh Tế", "Tân Châu", "Long Phú", "Tịnh Biên", "Thới Sơn", "Chi Lăng", "Vĩnh Thông",
  "Rạch Giá", "Hà Tiên", "Tô Châu", "Kiên Hải", "Phú Quốc", "Thổ Châu",
];

// So khớp tên khu vực: bỏ dấu, bỏ tiền tố "Xã", "Phường", "Đặc khu", "TP."...
function normalizeAreaName(s: string): string {
  return removeVietnameseTones(s || "")
    .replace(/^(xa|phuong|dac khu|thi tran|tp\.?|thanh pho|huyen)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
const AN_GIANG_AREA_SET = new Set(AN_GIANG_AREAS.map(normalizeAreaName));
function isInAnGiangAreas(region: string): boolean {
  return AN_GIANG_AREA_SET.has(normalizeAreaName(region));
}

// Thứ tự & số thứ tự chính thức của 102 xã / phường / đặc khu An Giang (đúng như bảng danh sách)
const AN_GIANG_AREAS_OFFICIAL_ORDER: string[] = [
  "An Phú", "Vĩnh Hậu", "Nhơn Hội", "Khánh Bình", "Phú Hữu", "Tân An", "Châu Phong",
  "Vĩnh Xương", "Phú Tân", "Phú An", "Bình Thạnh Đông", "Chợ Vàm", "Hòa Lạc", "Phú Lâm",
  "Châu Phú", "Mỹ Đức", "Vĩnh Thạnh Trung", "Bình Mỹ", "Thạnh Mỹ Tây", "An Cư", // 1-20
  "Núi Cấm", "Ba Chúc", "Tri Tôn", "Ô Lâm", "Cô Tô", "Vĩnh Gia", "An Châu", "Bình Hòa",
  "Cần Đăng", "Vĩnh Hanh", "Vĩnh An", "Chợ Mới", "Cù Lao Giêng", "Hội An", "Long Điền",
  "Nhơn Mỹ", "Long Kiến", "Thoại Sơn", "Óc Eo", "Định Mỹ", // 21-40
  "Phú Hòa", "Vĩnh Trạch", "Tây Phú", "Vĩnh Bình", "Vĩnh Thuận", "Vĩnh Phong", "Vĩnh Hòa",
  "U Minh Thượng", "Đông Hòa", "Tân Thạnh", "Đông Hưng", "An Minh", "Vân Khánh", "Tây Yên",
  "Đông Thái", "An Biên", "Định Hòa", "Gò Quao", "Vĩnh Hòa Hưng", "Vĩnh Tuy", // 41-60
  "Giồng Riềng", "Thạnh Hưng", "Long Thạnh", "Hòa Hưng", "Ngọc Chúc", "Hòa Thuận", "Tân Hội",
  "Tân Hiệp", "Thạnh Đông", "Thạnh Lộc", "Châu Thành", "Bình An", "Hòn Đất", "Sơn Kiên",
  "Mỹ Thuận", "Hòa Điền", "Kiên Lương", "Giang Thành", "Vĩnh Điều", // 61-79
  "Long Xuyên", "Bình Đức", "Mỹ Thới", "Châu Đốc", "Vĩnh Tế", "Tân Châu", "Long Phú",
  "Tịnh Biên", "Thới Sơn", "Chi Lăng", "Vĩnh Thông", "Rạch Giá", "Hà Tiên", "Tô Châu",
  "Kiên Hải", "Phú Quốc", "Thổ Châu", // 80-96 (phường & đặc khu)
  "Mỹ Hòa Hưng", "Bình Giang", "Bình Sơn", "Hòn Nghệ", "Sơn Hải", "Tiên Hải", // 97-102
];
// Không dùng "new Map" vì tên "Map" đang là icon lucide-react
const AN_GIANG_AREA_NUMBER: Record<string, number> = {};
AN_GIANG_AREAS_OFFICIAL_ORDER.forEach((n, i) => {
  AN_GIANG_AREA_NUMBER[normalizeAreaName(n)] = i + 1;
});
// Trả về số thứ tự 1-102 của khu vực (undefined nếu không nằm trong danh sách)
function getAreaNumber(regionName: string): number | undefined {
  return AN_GIANG_AREA_NUMBER[normalizeAreaName(regionName)];
}

// Tên chuẩn của khu vực: "Xã Tri Tôn", "xa tri ton", "Tri Tôn" -> "Tri Tôn" (khu vực ngoài danh sách giữ nguyên)
const AN_GIANG_AREA_OFFICIAL_NAME: Record<string, string> = {};
AN_GIANG_AREAS_OFFICIAL_ORDER.forEach((n) => {
  AN_GIANG_AREA_OFFICIAL_NAME[normalizeAreaName(n)] = n;
});
const ISLAND_AREA_KEYS = ["Phú Quốc", "Kiên Hải", "Thổ Châu"].map(normalizeAreaName);
function canonicalRegionName(name: string): string {
  const raw = (name || "").trim();
  return AN_GIANG_AREA_OFFICIAL_NAME[normalizeAreaName(raw)] || raw;
}

// Gộp các khu vực trùng nhau (cùng tên sau khi bỏ dấu/tiền tố Xã-Phường-Đặc khu), chuyển địa điểm
// sang tên chuẩn và bổ sung các xã/phường/đặc khu còn thiếu trong danh sách 102. Chạy lặp lại vẫn an toàn.
function mergeRegionsAndPlaces(
  regionsIn: RegionItem[],
  placesIn: PlaceItem[]
): { regions: RegionItem[]; places: PlaceItem[] } {
  const byKey: Record<string, RegionItem> = {};
  const order: string[] = [];

  regionsIn.forEach((r) => {
    const canon = canonicalRegionName(r.name);
    const key = normalizeAreaName(canon);
    if (!key) return;
    const exact = r.name.trim() === canon;
    const existing = byKey[key];
    if (!existing) {
      byKey[key] = {
        ...r,
        name: canon,
        displayLabel: exact ? r.displayLabel || canon : canon,
        isIsland: r.isIsland || ISLAND_AREA_KEYS.includes(key) || undefined,
      };
      order.push(key);
    } else {
      byKey[key] = {
        ...existing,
        displayLabel: exact ? r.displayLabel || existing.displayLabel : existing.displayLabel,
        isIsland: existing.isIsland || r.isIsland || undefined,
      };
    }
  });

  // Bổ sung các khu vực còn thiếu trong danh sách 102
  AN_GIANG_AREAS_OFFICIAL_ORDER.forEach((name, i) => {
    const key = normalizeAreaName(name);
    if (!byKey[key]) {
      byKey[key] = {
        id: `reg-official-${i + 1}`,
        name,
        displayLabel: name,
        isIsland: ISLAND_AREA_KEYS.includes(key) || undefined,
      };
      order.push(key);
    }
  });

  const places = placesIn.map((p) => {
    const reg = byKey[normalizeAreaName(p.region)];
    return reg && reg.name !== p.region ? { ...p, region: reg.name } : p;
  });

  return { regions: order.map((k) => byKey[k]), places };
}

// =====================================================================
// LẬP HÀNH TRÌNH: HẰNG SỐ & HÀM TÍNH LỊCH TRÌNH TỪNG NGÀY
// =====================================================================
type IslandKey = "pq" | "kh" | "tc";
type VehicleKind = "personal_car" | "motorbike" | "rental_car";
type PaceKind = "slow" | "normal" | "busy";

interface TripPt {
  lat: number;
  lng: number;
  name: string;
  island?: IslandKey;
}

interface TripSeg {
  kind: "drive" | "ferry";
  km: number;
  min: number;
  toName?: string; // chặng đường bộ: đi tới đâu
  from?: string; // chặng tàu/phà
  to?: string;
}

interface TripItem {
  place: PlaceItem;
  legs: TripSeg[];
  start: number; // phút trong ngày
  end: number;
}

interface TripDayResult {
  day: number;
  dateLabel: string;
  startFrom: string;
  startMin: number;
  items: TripItem[];
  eveningLegs: TripSeg[];
  returnLegs: TripSeg[];
  overnightName: string | null;
  overnightPlace: PlaceItem | null;
  overnightSuggested: boolean;
  foodSuggest: PlaceItem | null;
  endMin: number;
  isLast: boolean;
}

interface TripSchedule {
  days: TripDayResult[];
  roadKm: number;
  ferryKm: number;
  driveMin: number;
  ferryMin: number;
  ferryCrossings: number;
  warnings: string[];
}

const TRIP_ORIGINS: { name: string; lat: number; lng: number; island?: IslandKey }[] = [
  { name: "Rạch Giá", lat: 10.0125, lng: 105.0809 },
  { name: "Hà Tiên", lat: 10.383, lng: 104.4875 },
  { name: "Long Xuyên", lat: 10.3758, lng: 105.4185 },
  { name: "Châu Đốc", lat: 10.7, lng: 105.1167 },
  { name: "Phú Quốc", lat: 10.2167, lng: 103.9667, island: "pq" },
];

interface FerryGateway {
  mainland: { name: string; lat: number; lng: number };
  island: { name: string; lat: number; lng: number };
  km: number;
  min: number;
}

const RG_PIER = { name: "Bến tàu Rạch Giá", lat: 10.0145, lng: 105.0752 };
const HT_PIER = { name: "Bến tàu Hà Tiên", lat: 10.3792, lng: 104.4795 };
const ISLAND_GATEWAYS: Record<IslandKey, FerryGateway[]> = {
  pq: [
    {
      mainland: RG_PIER,
      island: { name: "Cảng tàu Bãi Vòng Phú Quốc", lat: 10.1462, lng: 104.0625 },
      km: 120,
      min: 180,
    },
    {
      mainland: HT_PIER,
      island: { name: "Cảng tàu Bãi Vòng Phú Quốc", lat: 10.1462, lng: 104.0625 },
      km: 55,
      min: 100,
    },
  ],
  kh: [
    {
      mainland: RG_PIER,
      island: { name: "Cầu cảng Hòn Sơn", lat: 9.7972, lng: 104.6295 },
      km: 83,
      min: 150,
    },
  ],
  tc: [
    {
      mainland: RG_PIER,
      island: { name: "Cầu cảng Bãi Ngự Thổ Châu", lat: 9.3082, lng: 103.4839 },
      km: 198,
      min: 330,
    },
  ],
};

const ISLAND_BY_AREA: Record<string, IslandKey> = {
  "phu quoc": "pq",
  "kien hai": "kh",
  "tho chau": "tc",
};
function islandOfRegion(region: string): IslandKey | undefined {
  return ISLAND_BY_AREA[normalizeAreaName(region)];
}

function parseClock(s: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(s || "");
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}
function fmtClock(min: number): string {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} phút`;
  return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
}
function formatDong(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString("vi-VN")} đ`;
}

const WEEKDAYS_VI = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
function dayDateLabel(startDate: string, offset: number): string {
  if (!startDate) return "";
  const d = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + offset);
  return `${WEEKDAYS_VI[d.getDay()]}, ${d.getDate()} thg ${d.getMonth() + 1}`;
}

// Thời gian tham quan mỗi điểm (phút): [thư thả, vừa phải, nhiều trải nghiệm]
function visitMinutes(p: PlaceItem, pace: PaceKind): number {
  const table: Record<string, [number, number, number]> = {
    THAM_QUAN: [180, 120, 90],
    AM_THUC: [75, 60, 45],
    MUA_SAM: [120, 90, 60],
    LE_HOI: [150, 120, 90],
  };
  const row = table[p.tab] || [120, 90, 60];
  return row[pace === "slow" ? 0 : pace === "normal" ? 1 : 2];
}

function driveSeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  toName: string,
  vehicle: VehicleKind
): TripSeg {
  // Ước tính: đường chim bay x 1,3; ô tô 40 km/h, xe máy 35 km/h
  const km = Math.max(0.5, haversineKm(a.lat, a.lng, b.lat, b.lng) * 1.3);
  const speed = vehicle === "motorbike" ? 35 : 40;
  return {
    kind: "drive",
    km: Math.round(km * 10) / 10,
    min: Math.max(2, Math.round((km / speed) * 60)),
    toName,
  };
}

function bestGateway(
  island: IslandKey,
  mainlandPt: { lat: number; lng: number },
  islandPt: { lat: number; lng: number }
): FerryGateway {
  let best = ISLAND_GATEWAYS[island][0];
  let bestScore = Infinity;
  for (const g of ISLAND_GATEWAYS[island]) {
    const s =
      haversineKm(mainlandPt.lat, mainlandPt.lng, g.mainland.lat, g.mainland.lng) +
      haversineKm(g.island.lat, g.island.lng, islandPt.lat, islandPt.lng);
    if (s < bestScore) {
      best = g;
      bestScore = s;
    }
  }
  return best;
}

// Các chặng di chuyển giữa 2 điểm (tự thêm chặng tàu/phà khi đi / về đảo)
function planLeg(from: TripPt, to: TripPt, vehicle: VehicleKind): TripSeg[] {
  if (from.island === to.island) return [driveSeg(from, to, to.name, vehicle)];

  const segs: TripSeg[] = [];
  let cur: { lat: number; lng: number } = from;

  if (from.island) {
    const ref = to.island ? ISLAND_GATEWAYS[to.island][0].mainland : to;
    const gw = bestGateway(from.island, ref, from);
    segs.push(driveSeg(from, gw.island, gw.island.name, vehicle));
    segs.push({ kind: "ferry", km: gw.km, min: gw.min, from: gw.island.name, to: gw.mainland.name });
    cur = gw.mainland;
  }

  if (to.island) {
    const gw = bestGateway(to.island, cur, to);
    segs.push(driveSeg(cur, gw.mainland, gw.mainland.name, vehicle));
    segs.push({ kind: "ferry", km: gw.km, min: gw.min, from: gw.mainland.name, to: gw.island.name });
    segs.push(driveSeg(gw.island, to, to.name, vehicle));
  } else {
    segs.push(driveSeg(cur, to, to.name, vehicle));
  }
  return segs;
}

// Soạn lịch trình từng ngày: xếp điểm theo thứ tự, theo giờ khởi hành / kết thúc và nhịp độ
function buildTripSchedule(args: {
  origin: TripPt;
  stops: PlaceItem[];
  dayCount: number;
  startMin: number;
  endMin: number;
  pace: PaceKind;
  vehicle: VehicleKind;
  roundTrip: boolean;
  startDate: string;
  allPlaces: PlaceItem[];
}): TripSchedule {
  const { origin, dayCount, startMin, endMin, pace, vehicle, roundTrip, startDate, allPlaces } = args;
  const toPt = (p: PlaceItem): TripPt => ({
    lat: p.latitude,
    lng: p.longitude,
    name: p.name,
    island: islandOfRegion(p.region),
  });

  const stays = args.stops.filter((p) => p.tab === "NHA_NGHI");
  const stops = args.stops.filter((p) => p.tab !== "NHA_NGHI");
  const used = new Set(args.stops.map((p) => p.id));

  const nearest = (tab: FunctionalTab, a: { lat: number; lng: number }): PlaceItem | null => {
    let best: PlaceItem | null = null;
    let bestKm = Infinity;
    for (const p of allPlaces) {
      if (!p.isVisible || p.tab !== tab || used.has(p.id)) continue;
      const km = haversineKm(a.lat, a.lng, p.latitude, p.longitude);
      if (km < bestKm) {
        best = p;
        bestKm = km;
      }
    }
    if (best) used.add(best.id);
    return best;
  };

  const newDay = (i: number, startFrom: string): TripDayResult => ({
    day: i + 1,
    dateLabel: dayDateLabel(startDate, i),
    startFrom,
    startMin,
    items: [],
    eveningLegs: [],
    returnLegs: [],
    overnightName: null,
    overnightPlace: null,
    overnightSuggested: false,
    foodSuggest: null,
    endMin: startMin,
    isLast: i === dayCount - 1,
  });

  const days: TripDayResult[] = [newDay(0, origin.name)];
  let dayIdx = 0;
  let clock = startMin;
  let pos: TripPt = origin;
  let stayCursor = 0;

  const advanceDay = () => {
    const d = days[dayIdx];
    const stayPlace = stays.length ? stays[Math.min(stayCursor, stays.length - 1)] : null;
    stayCursor++;
    if (stayPlace) {
      d.overnightPlace = stayPlace;
      d.overnightName = stayPlace.name;
      d.overnightSuggested = false;
      d.eveningLegs = planLeg(pos, toPt(stayPlace), vehicle);
      pos = toPt(stayPlace);
    } else {
      d.overnightName = pos.name;
      const sug = nearest("NHA_NGHI", pos);
      if (sug) {
        d.overnightPlace = sug;
        d.overnightSuggested = true;
      }
    }
    dayIdx++;
    days.push(newDay(dayIdx, pos.name));
    clock = startMin;
  };

  for (let i = 0; i < stops.length; i++) {
    const p = stops[i];
    const dest = toPt(p);
    let legs = planLeg(pos, dest, vehicle);
    let travel = legs.reduce((s, l) => s + l.min, 0);
    const dur = visitMinutes(p, pace);
    const daysLeft = dayCount - 1 - dayIdx;
    const remaining = stops.length - i;
    if (
      days[dayIdx].items.length > 0 &&
      daysLeft > 0 &&
      (clock + travel + dur > endMin || remaining <= daysLeft)
    ) {
      advanceDay();
      legs = planLeg(pos, dest, vehicle);
      travel = legs.reduce((s, l) => s + l.min, 0);
    }
    const start = clock + travel;
    const end = start + dur;
    days[dayIdx].items.push({ place: p, legs, start, end });
    clock = end;
    pos = dest;
  }

  // Các ngày còn lại không có điểm nào (ngày tự do)
  while (dayIdx < dayCount - 1) advanceDay();

  const lastDay = days[days.length - 1];
  if (roundTrip) {
    const back = planLeg(pos, origin, vehicle);
    lastDay.returnLegs = back;
    clock += back.reduce((s, l) => s + l.min, 0);
  }

  const warnings: string[] = [];
  days.forEach((d) => {
    d.endMin = d.items.length ? d.items[d.items.length - 1].end : d.startMin;
    if (d.isLast && roundTrip) d.endMin = Math.max(d.endMin, clock);
    if (d.items.length && !d.items.some((it) => it.place.tab === "AM_THUC")) {
      const mid = d.items[Math.floor(d.items.length / 2)].place;
      d.foodSuggest = nearest("AM_THUC", { lat: mid.latitude, lng: mid.longitude });
    }
    if (d.endMin > endMin) {
      warnings.push(
        `Ngày ${d.day} kết thúc khoảng ${fmtClock(d.endMin)}, muộn hơn giờ kết thúc dự kiến (${fmtClock(
          endMin
        )}). Bạn có thể tăng số ngày, chọn nhịp độ "Nhiều trải nghiệm" hoặc bớt điểm đến.`
      );
    }
    d.items.forEach((it) => {
      const m = /(\d{1,2})[:h](\d{2})\s*[-–]\s*(\d{1,2})[:h](\d{2})/.exec(it.place.openingHours || "");
      if (!m) return;
      const open = Number(m[1]) * 60 + Number(m[2]);
      const close = Number(m[3]) * 60 + Number(m[4]);
      if (close > open && (it.start < open || it.end > close)) {
        warnings.push(
          `${it.place.name}: giờ mở cửa ${it.place.openingHours}, lịch dự kiến ${fmtClock(
            it.start
          )}–${fmtClock(it.end)}. Hãy kiểm tra lại giờ mở cửa.`
        );
      }
    });
  });

  const allLegs: TripSeg[] = [];
  days.forEach((d) => {
    d.items.forEach((it) => allLegs.push(...it.legs));
    allLegs.push(...d.eveningLegs, ...d.returnLegs);
  });
  const sum = (kind: "drive" | "ferry", key: "km" | "min") =>
    allLegs.filter((l) => l.kind === kind).reduce((s, l) => s + l[key], 0);

  return {
    days,
    roadKm: Math.round(sum("drive", "km") * 10) / 10,
    ferryKm: sum("ferry", "km"),
    driveMin: sum("drive", "min"),
    ferryMin: sum("ferry", "min"),
    ferryCrossings: allLegs.filter((l) => l.kind === "ferry").length,
    warnings,
  };
}

// Lịch trình do AI (Gemini) soạn: tổng quan, từng ngày, ghi chú từng điểm và lời khuyên chung
interface AiTripPlan {
  overview: string;
  days: {
    day: number;
    title: string;
    summary: string;
    stops: { placeId: string; note: string }[];
    mealTip: string;
    stayTip: string;
  }[];
  tips: string[];
}

// Chỉ nhận id địa điểm có thật, mỗi điểm 1 lần; cắt ngắn chữ để giao diện không bị vỡ
function sanitizeAiPlan(raw: unknown, validIds: Set<string>): AiTripPlan | null {
  const r = raw as { overview?: unknown; days?: unknown; tips?: unknown } | null;
  if (!r || !Array.isArray(r.days)) return null;
  const seen = new Set<string>();
  const days = (r.days as unknown[]).slice(0, 7).map((d, i) => {
    const x = d as Record<string, unknown>;
    const stops = (Array.isArray(x?.stops) ? (x.stops as unknown[]) : [])
      .map((s) => s as Record<string, unknown>)
      .filter((s) => {
        const id = String(s?.placeId ?? "");
        if (!validIds.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((s) => ({ placeId: String(s.placeId), note: String(s.note ?? "").slice(0, 200) }));
    return {
      day: Number(x?.day) || i + 1,
      title: String(x?.title ?? "").slice(0, 100),
      summary: String(x?.summary ?? "").slice(0, 400),
      stops,
      mealTip: String(x?.mealTip ?? "").slice(0, 300),
      stayTip: String(x?.stayTip ?? "").slice(0, 300),
    };
  });
  if (days.every((d) => d.stops.length === 0)) return null;
  return {
    overview: String(r.overview ?? "").slice(0, 600),
    days,
    tips: (Array.isArray(r.tips) ? (r.tips as unknown[]) : []).slice(0, 8).map((s) => String(s).slice(0, 220)),
  };
}

// Ô nhập số có đơn vị (đ, %, ...)
function PlannerNumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// Ô tìm & thêm điểm đến: lọc theo khu vực, loại hình và gõ tên (không dấu cũng được)
function TripPlacePicker({
  places,
  regions,
  tabLabels,
  excludeIds,
  onAdd,
}: {
  places: PlaceItem[];
  regions: RegionItem[];
  tabLabels: Record<string, string>;
  excludeIds: string[];
  onAdd: (id: string) => void;
}) {
  const [region, setRegion] = useState<string>("ALL");
  const [tab, setTab] = useState<string>("ALL");
  const [query, setQuery] = useState<string>("");

  const results = useMemo(() => {
    return places
      .filter(
        (p) =>
          p.isVisible &&
          !excludeIds.includes(p.id) &&
          (region === "ALL" || p.region === region) &&
          (tab === "ALL" || p.tab === tab) &&
          (!query.trim() ||
            matchesVietnameseSearch(p.name, query) ||
            matchesVietnameseSearch(p.address, query) ||
            matchesVietnameseSearch(p.subCategory, query))
      )
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [places, excludeIds, region, tab, query]);

  const tabIcon: Record<string, string> = {
    THAM_QUAN: "🏛️",
    AM_THUC: "🍜",
    NHA_NGHI: "🏨",
    MUA_SAM: "🛍️",
    LE_HOI: "🎉",
  };

  return (
    <div className="space-y-2.5 p-3 rounded-[16px] bg-white border border-slate-200 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Khu vực</label>
          <SearchableRegionSelect
            regions={regions}
            places={places}
            value={region}
            onChange={setRegion}
            includeAllOption={true}
            allOptionLabel="Tất cả khu vực"
            variant="admin"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Loại hình</label>
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-800 font-semibold"
          >
            <option value="ALL">Tất cả loại hình</option>
            <option value="THAM_QUAN">🏛️ {tabLabels.THAM_QUAN}</option>
            <option value="AM_THUC">🍜 {tabLabels.AM_THUC}</option>
            <option value="NHA_NGHI">🏨 {tabLabels.NHA_NGHI}</option>
            <option value="MUA_SAM">🛍️ {tabLabels.MUA_SAM}</option>
            <option value="LE_HOI">🎉 {tabLabels.LE_HOI}</option>
          </select>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Thêm điểm đến... (gõ tên, không dấu cũng được)"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white bg-white/95 shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </div>

      <p className="text-xs font-bold text-teal-800">
        {results.length} địa điểm phù hợp — bấm để thêm vào hành trình
      </p>
      <div className="max-h-72 overflow-y-auto rounded-[16px] border border-slate-200 bg-[#F5F7F8] divide-y divide-slate-200">
        {results.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">Không có địa điểm phù hợp.</p>
        ) : (
          results.slice(0, 60).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAdd(p.id)}
              className="w-full flex items-center justify-between gap-3 px-2.5 py-2 text-left hover:bg-teal-50 transition cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-14 h-11 object-cover rounded-xl bg-slate-200 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 truncate">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-600 min-w-0">
                    <span className="px-2 py-0.5 rounded-full bg-[#204E4A]/90 text-white font-bold shrink-0">
                      {tabIcon[p.tab] || "📍"} {p.subCategory}
                    </span>
                    <span className="truncate">{p.region}</span>
                  </span>
                </span>
              </span>
              <span className="shrink-0 w-8 h-8 rounded-full bg-[#047857] hover:bg-emerald-800 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                +
              </span>
            </button>
          ))
        )}
        {results.length > 60 && (
          <p className="p-2 text-center text-[11px] text-slate-400">
            Còn {results.length - 60} địa điểm nữa, hãy gõ tên hoặc chọn khu vực để thu hẹp.
          </p>
        )}
      </div>
    </div>
  );
}

// Khóa nhận diện địa điểm trùng: tên + khu vực (không phân biệt hoa/thường, dấu, khoảng trắng thừa)
function makePlaceKey(name: string, region: string): string {
  const clean = (s: string) => removeVietnameseTones(s || "").replace(/\s+/g, " ");
  return `${clean(name)}|${clean(region)}`;
}

// Hiển thị khoảng cách dạng ước lượng: 33 km -> "~35 km", 7,4 km -> "~7 km"
function formatApproxKm(km: number): string {
  const v = Number(km) || 0;
  const approx = v < 10 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5;
  return `~${approx} km`;
}

// Link mở Google Maps với từ khóa tìm kiếm là tên địa điểm (không dùng tọa độ)
function buildGoogleMapsSearchUrl(place: { name: string; region: string }): string {
  const query = `${place.name}, ${place.region}, An Giang`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const PRESET_BADGE_ICONS = [
  "🏛️",
  "🚠",
  "🌊",
  "🏖️",
  "⛰️",
  "🌿",
  "🏞️",
  "💧",
  "🍜",
  "🏨",
  "🛍️",
  "🎉",
  "⛩️",
  "🚤",
  "📸",
  "📍",
];

// --- 20 QUY TẮC ỨNG XỬ VĂN MINH DU LỊCH (TRANG 8-9 SỔ TAY) ---
const CIVILIZED_RULES = [
  { id: "01", vi: "Tuân thủ các nội quy, bảng chỉ dẫn khi đi du lịch.", en: "Comply with the rules and signs when traveling." },
  { id: "02", vi: "Xếp hàng theo thứ tự.", en: "Line up in order." },
  { id: "03", vi: "Đi đúng giờ, ngồi đúng chỗ.", en: "Arrive on time, take the right seat." },
  { id: "04", vi: "Trang phục lịch sự, phù hợp.", en: "Wear appropriate and polite clothing." },
  { id: "05", vi: "Tôn trọng sự khác biệt về văn hóa và cộng đồng địa phương.", en: "Respect cultural differences and local communities." },
  { id: "06", vi: "Lên kế hoạch trước khi đi du lịch.", en: "Plan before travel." },
  { id: "07", vi: "Hành lý gọn gàng.", en: "Properly prepare suitcases." },
  { id: "08", vi: "Ứng xử văn minh, thân thiện và vui chơi lành mạnh.", en: "Be civilized, friendly and play healthily." },
  { id: "09", vi: "Lấy thức ăn, đồ uống vừa đủ dùng.", en: "Get enough food and drink." },
  { id: "10", vi: "Tiết kiệm năng lượng, bảo vệ môi trường.", en: "Save energy, protect the environment." },
  { id: "11", vi: "Ủng hộ các sản phẩm và đồ lưu niệm sản xuất tại địa phương.", en: "Support locally made products and souvenirs." },
  { id: "12", vi: "Không chen lấn, xô đẩy, gây ồn ào, mất trật tự.", en: "Do not jostle, push, and make noise or disorder." },
  { id: "13", vi: "Không vứt rác, hút thuốc, khạc nhổ và đi vệ sinh bừa bãi.", en: "Do not litter, smoke, spit and defecate indiscriminately." },
  { id: "14", vi: "Không phá hoại môi trường, cảnh quan du lịch.", en: "Do not destroy the environment, tourist landscape." },
  { id: "15", vi: "Không sử dụng sản phẩm từ các loài động, thực vật hoang dã.", en: "Do not use products from wild flora and fauna." },
  { id: "16", vi: "Không cố tình quay phim, chụp ảnh tại những nơi không được phép.", en: "Do not knowingly film or take photos in unauthorized places." },
  { id: "17", vi: "Không lấy đồ không thuộc về mình.", en: "Do not take anything from others." },
  { id: "18", vi: "Không mua bán hàng hóa không rõ nguồn gốc xuất xứ.", en: "Do not buy or sell goods with no clear origin." },
  { id: "19", vi: "Không đến các khu vực không an toàn.", en: "Do not go to unsafe areas." },
  { id: "20", vi: "Không vi phạm pháp luật khi đi du lịch.", en: "Do not violate the law when traveling." },
];

// --- DANH BẠ KHẨN CẤP ---
const EMERGENCY_HOTLINES = [
  {
    group: "Đường dây nóng toàn tỉnh & Cơ quan Du lịch ",
    items: [
      { title: "Công an / Cứu hỏa / Cấp cứu", phone: "113 / 114 / 115" },
      { title: "Sở Du lịch (52 Trần Phú, Rạch Giá)", phone: "0297 3781 999" },
      { title: "TT Xúc tiến ĐT, TM & Du lịch", phone: "0297 3885 888" },
    ],
  },
  {
    group: "Đặc khu Phú Quốc & Kiên Hải ",
    items: [
      { title: "Cấp cứu Y tế Phú Quốc", phone: "0297 3846 074" },
      { title: "Công an Phú Quốc", phone: "0297 3846 051" },
      { title: "Trạm Y tế Hòn Sơn / Nam Du", phone: "0297 3688 014" },
    ],
  },
  {
    group: "Rạch Giá, Hà Tiên & U Minh Thượng ",
    items: [
      { title: "BV Đa khoa Rạch Giá", phone: "0297 3863 328" },
      { title: "BQL Bến xe, tàu Hà Tiên", phone: "0297 3851 414" },
      { title: "BQL VQG U Minh Thượng", phone: "0297 3883 037" },
    ],
  },
  {
    group: "Long Xuyên & Châu Đốc ",
    items: [
      { title: "BV Đa khoa TT An Giang (Long Xuyên)", phone: "0296 3852 862" },
      { title: "BV Đa khoa KV Châu Đốc", phone: "0296 3569 568" },
      { title: "Công an Châu Đốc", phone: "0296 3866 234" },
    ],
  },
];

const HERO_BG_URL =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=85";
// --- DỮ LIỆU BẾN TÀU, BẾN XE, SÂN BAY CỐ ĐỊNH TRÊN BẢN ĐỒ ---
const DEFAULT_TRANSIT_HUBS: TransitHub[] = [
  { id: "hub-1", name: "Bến tàu Rạch Giá", type: "ferry", lat: 10.0145, lng: 105.0752, note: "Tàu cao tốc đi Phú Quốc, Hòn Sơn, Nam Du, Thổ Châu" },
  { id: "hub-2", name: "Bến tàu Hà Tiên", type: "ferry", lat: 10.3792, lng: 104.4795, note: "Tàu cao tốc & phà đi Phú Quốc, Quần đảo Hải Tặc" },
  { id: "hub-3", name: "Cảng Bãi Vòng Phú Quốc", type: "ferry", lat: 10.1462, lng: 104.0625, note: "Cảng tàu cao tốc chính tại Phú Quốc" },
  { id: "hub-4", name: "Cảng An Thới Phú Quốc", type: "ferry", lat: 10.0082, lng: 104.0118, note: "Cảng đi quần đảo An Thới & Đặc khu Thổ Châu" },
  { id: "hub-5", name: "Cầu cảng Hòn Sơn", type: "ferry", lat: 9.7972, lng: 104.6295, note: "Bến tàu Bãi Nhà - Đặc khu Kiên Hải" },
  { id: "hub-6", name: "Cầu cảng Nam Du", type: "ferry", lat: 9.6806, lng: 104.3475, note: "Bến tàu Hòn Lớn - Quần đảo Nam Du" },
  { id: "hub-7", name: "Cầu cảng Bãi Ngự Thổ Châu", type: "ferry", lat: 9.3082, lng: 103.4839, note: "Bến tàu Đặc khu Thổ Châu" },
  { id: "hub-8", name: "Cảng hàng không Quốc tế Phú Quốc", type: "airport", lat: 10.1698, lng: 103.9931, note: "Sân bay Quốc tế Phú Quốc" },
  { id: "hub-9", name: "Cảng hàng không Rạch Giá", type: "airport", lat: 9.9592, lng: 105.1338, note: "Sân bay Rạch Giá" },
  { id: "hub-10", name: "Bến xe Long Xuyên", type: "bus", lat: 10.3625, lng: 105.4521, note: "Trung tâm vận tải hành khách Long Xuyên" },
  { id: "hub-11", name: "Bến xe Châu Đốc", type: "bus", lat: 10.6865, lng: 105.1012, note: "Bến xe khách trung tâm Châu Đốc" },
  { id: "hub-12", name: "Bến phà Châu Giang / Tân Châu", type: "ferry", lat: 10.7105, lng: 105.1325, note: "Kết nối giao thông đường thủy sông Hậu - sông Tiền" },
];

const HUB_META: Record<HubType, { label: string; symbol: string; plural: string }> = {
  ferry: { label: "Bến tàu", symbol: "⚓", plural: "Bến tàu / cảng / phà" },
  bus: { label: "Bến xe", symbol: "🚌", plural: "Bến xe" },
  airport: { label: "Sân bay", symbol: "✈️", plural: "Sân bay" },
};

// Các lớp điểm đến có thể bật/tắt trên bản đồ (theo từng mục chức năng)
const MAP_PLACE_LAYERS: { tab: FunctionalTab; label: string; symbol: string; color: string }[] = [
  { tab: "THAM_QUAN", label: "Tham quan", symbol: "📍", color: "#0284c7" },
  { tab: "AM_THUC", label: "Ẩm thực", symbol: "🍜", color: "#d97706" },
  { tab: "MUA_SAM", label: "Mua sắm", symbol: "🛍️", color: "#0d9488" },
  { tab: "NHA_NGHI", label: "Nhà nghỉ", symbol: "🏨", color: "#0f766e" },
  { tab: "LE_HOI", label: "Lễ hội", symbol: "🎉", color: "#9333ea" },
];

// Nhận diện loại bến từ chữ trong cột "Loại" hoặc từ tên
function detectHubType(typeText: string, name: string): HubType {
  const t = removeVietnameseTones(`${typeText} ${name}`);
  if (/san bay|hang khong|airport/.test(t)) return "airport";
  if (/ben xe|xe khach|\bbus\b/.test(t)) return "bus";
  return "ferry";
}

// Phân loại màu chấm tròn trên bản đồ theo đúng bảng chú thích
function getPlaceMapCategory(place: PlaceItem): { key: string; label: string; color: string } {
  const text = `${place.subCategory} ${place.name} ${place.tags.join(" ")}`.toLowerCase();
  if (text.includes("biển") || text.includes("đảo") || text.includes("bãi") || ["Phú Quốc", "Kiên Hải", "Thổ Châu"].includes(place.region)) {
    return { key: "sea_island", label: "Biển đảo", color: "#0284c7" }; // Xanh dương
  }
  if (text.includes("sinh thái") || text.includes("rừng") || text.includes("hồ") || text.includes("suối") || text.includes("vườn")) {
    return { key: "ecology", label: "Sinh thái", color: "#16a34a" }; // Xanh lá
  }
  if (text.includes("lịch sử") || text.includes("di tích") || text.includes("bảo tàng") || text.includes("nhà mồ") || text.includes("lăng")) {
    return { key: "history", label: "Lịch sử", color: "#b45309" }; // Nâu cam
  }
  if (text.includes("tâm linh") || text.includes("chùa") || text.includes("miếu") || text.includes("đình") || text.includes("tự")) {
    return { key: "spiritual", label: "Tâm linh", color: "#dc2626" }; // Đỏ
  }
  if (text.includes("văn hóa") || text.includes("lễ hội") || place.tab === "LE_HOI") {
    return { key: "culture", label: "Văn hóa", color: "#9333ea" }; // Tím
  }
  if (text.includes("cộng đồng") || text.includes("chợ") || text.includes("làng") || place.tab === "MUA_SAM") {
    return { key: "community", label: "Cộng đồng", color: "#0d9488" }; // Xanh cổ vịt
  }
  return { key: "entertainment", label: "Vui chơi giải trí", color: "#db2777" }; // Hồng
}

// Ranh giới tỉnh An Giang (mới, gồm đất liền + các đảo), dạng [kinh độ, vĩ độ], đã đơn giản hóa cho nhẹ.
// Nguồn: thanglequoc/vietnamese-provinces-database (GIS từ Bản đồ hành chính do NXB TN-MT-BĐVN phát hành).
const AN_GIANG_RINGS: [number, number][][] = [[[103.4943,9.3198],[103.5023,9.3214],[103.506,9.3191],[103.507,9.3143],[103.5089,9.3121],[103.5087,9.3102],[103.5023,9.3089],[103.4989,9.303],[103.503,9.3007],[103.5031,9.2986],[103.5013,9.2981],[103.4955,9.3005],[103.4934,9.3002],[103.4827,9.2873],[103.4744,9.287],[103.4709,9.2898],[103.4704,9.2946],[103.4714,9.2976],[103.4751,9.2996],[103.475,9.3026],[103.4701,9.3053],[103.4673,9.3044],[103.4643,9.3015],[103.4596,9.3015],[103.456,9.3048],[103.4569,9.3078],[103.4646,9.3156],[103.4752,9.3205],[103.4849,9.3218],[103.4923,9.3203]],[[103.5319,9.3164],[103.521,9.3226],[103.5214,9.3241],[103.5255,9.3257],[103.5264,9.3286],[103.5299,9.3277],[103.531,9.3252],[103.5325,9.3244],[103.5303,9.3216],[103.5328,9.3175],[103.5321,9.3165]],[[103.602,9.3859],[103.6002,9.3873],[103.6002,9.3903],[103.6021,9.3947],[103.6035,9.3953],[103.606,9.3947],[103.6062,9.3928],[103.6036,9.3864]],[[104.4016,9.6351],[104.3992,9.6319],[104.3982,9.6353],[104.3941,9.6351],[104.3922,9.6375],[104.4057,9.6426],[104.4048,9.64],[104.4007,9.637],[104.4012,9.6357]],[[104.4017,9.675],[104.4046,9.6748],[104.4007,9.672],[104.3999,9.669],[104.4009,9.6656],[104.3957,9.6633],[104.3936,9.6605],[104.3929,9.6622],[104.3966,9.6673],[104.3983,9.6718],[104.3976,9.6761],[104.3993,9.6772],[104.4014,9.675]],[[104.3859,9.6814],[104.386,9.6889],[104.3922,9.6932],[104.3945,9.692],[104.3918,9.6893],[104.3919,9.686],[104.3865,9.6816]],[[104.384,9.7095],[104.3868,9.7088],[104.386,9.7046],[104.3871,9.7022],[104.3827,9.6982],[104.3813,9.7021],[104.3823,9.7077],[104.3815,9.7104],[104.3825,9.711],[104.3838,9.7095]],[[104.3596,9.6947],[104.3569,9.6942],[104.3559,9.6898],[104.3563,9.684],[104.3587,9.6762],[104.3592,9.6645],[104.3605,9.6625],[104.3589,9.6602],[104.3518,9.6615],[104.3491,9.6681],[104.3459,9.6687],[104.3441,9.6839],[104.3451,9.6871],[104.3495,9.6894],[104.3484,9.6935],[104.3523,9.6932],[104.3535,9.6949],[104.3518,9.7065],[104.3523,9.7128],[104.3556,9.7115],[104.3591,9.7062],[104.3584,9.7026],[104.3609,9.6968],[104.36,9.6949]],[[104.6501,9.8182],[104.6563,9.8186],[104.6575,9.8159],[104.6538,9.8029],[104.6517,9.7997],[104.6475,9.7966],[104.6359,9.7938],[104.6334,9.7947],[104.6341,9.7967],[104.6324,9.7985],[104.6276,9.7999],[104.6174,9.7971],[104.6136,9.7975],[104.6128,9.7991],[104.6155,9.8096],[104.6216,9.8161],[104.6339,9.8234],[104.6409,9.8214],[104.643,9.819],[104.6484,9.8183]],[[102.8842,9.9324],[102.8862,9.9319],[102.8862,9.9287],[102.8909,9.9227],[102.8932,9.9218],[102.8974,9.9223],[102.9,9.9194],[102.9051,9.9177],[102.9039,9.9158],[102.8979,9.9149],[102.8949,9.9157],[102.891,9.9199],[102.8799,9.9277],[102.8779,9.9333],[102.8801,9.9344],[102.8833,9.9324]],[[102.9247,9.9259],[102.9274,9.9262],[102.9302,9.9239],[102.9337,9.9236],[102.9353,9.9221],[102.9355,9.9187],[102.9293,9.9156],[102.9166,9.9259],[102.9108,9.9336],[102.9108,9.9353],[102.9131,9.9366],[102.916,9.9353],[102.9193,9.9281],[102.9244,9.9259]],[[104.0213,9.9585],[104.0195,9.9515],[104.0234,9.9483],[104.0238,9.9456],[104.0213,9.9415],[104.0189,9.9416],[104.0152,9.9462],[104.0085,9.9496],[104.0086,9.9511],[104.0115,9.9529],[104.0118,9.9548],[104.0091,9.9582],[104.0111,9.9617],[104.0085,9.9658],[104.0087,9.9693],[104.0118,9.9701],[104.016,9.9683],[104.0207,9.961]],[[104.8541,9.9786],[104.856,9.9753],[104.8516,9.975],[104.8444,9.9698],[104.8395,9.9569],[104.8397,9.9539],[104.8344,9.9495],[104.8294,9.953],[104.8263,9.9579],[104.8255,9.9652],[104.827,9.9689],[104.8309,9.9719],[104.836,9.9725],[104.8376,9.9758],[104.8421,9.9751],[104.8496,9.9787],[104.8534,9.9788]],[[104.0233,9.9745],[104.025,9.9707],[104.024,9.9696],[104.0189,9.9747],[104.0158,9.9747],[104.0155,9.9789],[104.0127,9.9816],[104.0116,9.9849],[104.0137,9.9858],[104.0165,9.9851],[104.0215,9.9806],[104.0222,9.9784]],[[104.0094,9.9918],[104.0056,9.9952],[104.0054,9.9987],[104.0063,9.9995],[104.0097,9.9992],[104.0122,9.9959],[104.0124,9.9935],[104.0096,9.9918]],[[104.5498,10.0152],[104.5486,10.0161],[104.5425,10.0312],[104.5455,10.0361],[104.5517,10.0409],[104.5536,10.0399],[104.559,10.0296],[104.56,10.0237],[104.558,10.0178],[104.5513,10.0154]],[[104.541,10.1234],[104.5385,10.1277],[104.5407,10.1296],[104.5407,10.1343],[104.5444,10.1384],[104.545,10.1376],[104.5435,10.1268],[104.5414,10.1235]],[[104.5294,10.1702],[104.5283,10.1713],[104.5292,10.1749],[104.5284,10.1798],[104.522,10.1861],[104.5256,10.1895],[104.5296,10.1875],[104.5318,10.1825],[104.5311,10.1783],[104.5327,10.1725],[104.5297,10.1702]],[[104.3353,10.3198],[104.3326,10.3166],[104.3271,10.3135],[104.322,10.3191],[104.3219,10.3226],[104.3231,10.3229],[104.3283,10.3199],[104.3303,10.3217],[104.3304,10.3241],[104.3326,10.3243],[104.336,10.3225],[104.3354,10.32]],[[104.0312,10.4146],[104.0337,10.4147],[104.0374,10.417],[104.0404,10.4156],[104.0604,10.3957],[104.073,10.3774],[104.0789,10.3594],[104.079,10.3548],[104.075,10.3535],[104.0724,10.3499],[104.0708,10.3394],[104.0782,10.3089],[104.078,10.3022],[104.0738,10.2888],[104.0731,10.2792],[104.0738,10.2729],[104.0797,10.2513],[104.0789,10.2454],[104.0691,10.2172],[104.0579,10.2075],[104.0516,10.1948],[104.0414,10.1547],[104.0341,10.1488],[104.0298,10.1413],[104.0285,10.1341],[104.0338,10.1249],[104.0346,10.12],[104.0314,10.1145],[104.0247,10.1078],[104.023,10.0932],[104.0162,10.0849],[104.0176,10.0799],[104.0224,10.0748],[104.0239,10.0752],[104.0249,10.0789],[104.0264,10.0798],[104.0339,10.073],[104.0399,10.0714],[104.0415,10.0701],[104.0409,10.0661],[104.036,10.0608],[104.0335,10.0547],[104.0339,10.0489],[104.0372,10.0423],[104.0356,10.0407],[104.0322,10.0413],[104.0304,10.0402],[104.0288,10.0366],[104.0285,10.0323],[104.0387,10.0194],[104.0472,10.0137],[104.05,10.0099],[104.0499,10.0074],[104.0466,10.0075],[104.044,10.009],[104.0358,10.0167],[104.0325,10.0156],[104.0287,10.0118],[104.0221,10.019],[104.0195,10.0195],[104.0146,10.0182],[104.0114,10.0115],[104.0084,10.0111],[104.0072,10.0129],[104.007,10.0226],[103.9989,10.045],[103.9959,10.0476],[103.9907,10.0485],[103.989,10.0501],[103.988,10.0659],[103.9836,10.0948],[103.9656,10.1814],[103.959,10.208],[103.9458,10.2455],[103.9371,10.2578],[103.9279,10.265],[103.9208,10.2805],[103.9139,10.2888],[103.905,10.2931],[103.8985,10.2913],[103.8904,10.2914],[103.8799,10.3035],[103.8697,10.3086],[103.8627,10.3085],[103.8604,10.306],[103.8602,10.3032],[103.8588,10.3034],[103.8541,10.3098],[103.8543,10.3148],[103.849,10.3275],[103.8443,10.348],[103.8409,10.3569],[103.8374,10.3606],[103.8314,10.3627],[103.8307,10.3655],[103.8364,10.3718],[103.8366,10.3741],[103.835,10.3779],[103.8369,10.3789],[103.8494,10.3777],[103.8596,10.3748],[103.8862,10.3705],[103.9176,10.3608],[103.9205,10.3607],[103.9259,10.3628],[103.9351,10.3724],[103.9393,10.3798],[103.9453,10.4023],[103.9514,10.406],[103.9602,10.4077],[103.9653,10.4107],[103.9694,10.4228],[103.972,10.4413],[103.977,10.4471],[103.9824,10.4501],[103.995,10.4513],[104.0041,10.4478],[104.0207,10.423],[104.0254,10.4175],[104.0291,10.4153]],[[104.7143,10.5326],[104.7524,10.5201],[104.8559,10.5216],[104.8665,10.5227],[104.8987,10.5531],[104.9175,10.5828],[104.9332,10.6146],[104.947,10.6313],[104.9558,10.6401],[104.9625,10.6451],[104.9764,10.6516],[104.9812,10.6556],[105.0962,10.7225],[105.0907,10.7571],[105.0743,10.7794],[105.0629,10.7817],[105.0601,10.7998],[105.0565,10.807],[105.0567,10.8192],[105.0547,10.8256],[105.0471,10.8414],[105.0419,10.8481],[105.0337,10.8681],[105.027,10.8919],[105.0275,10.8935],[105.037,10.8978],[105.0436,10.9023],[105.0397,10.912],[105.0463,10.9166],[105.0512,10.9178],[105.051,10.923],[105.0488,10.9262],[105.0513,10.9306],[105.0604,10.9369],[105.0674,10.9401],[105.0751,10.938],[105.0764,10.9384],[105.0779,10.9468],[105.0773,10.9519],[105.0793,10.9557],[105.0821,10.9577],[105.0896,10.9558],[105.098,10.9563],[105.1116,10.9634],[105.1152,10.9623],[105.1163,10.9462],[105.1146,10.9427],[105.1062,10.9335],[105.0987,10.9231],[105.1029,10.9197],[105.106,10.9192],[105.1312,10.9232],[105.154,10.9249],[105.1785,10.9128],[105.1864,10.9125],[105.1893,10.8923],[105.1904,10.891],[105.1879,10.8734],[105.1937,10.8655],[105.2052,10.8572],[105.2101,10.8499],[105.2224,10.8288],[105.2227,10.8204],[105.227,10.8125],[105.236,10.8065],[105.25,10.8043],[105.2594,10.801],[105.2602,10.7982],[105.2596,10.7921],[105.2563,10.7829],[105.258,10.7751],[105.2616,10.7706],[105.2729,10.765],[105.2947,10.7642],[105.2988,10.7629],[105.3017,10.7603],[105.3023,10.7545],[105.2994,10.749],[105.2812,10.7385],[105.2757,10.7335],[105.2741,10.7285],[105.276,10.7248],[105.2883,10.7188],[105.2998,10.7171],[105.3242,10.7233],[105.3369,10.7239],[105.3427,10.7219],[105.3493,10.7149],[105.3495,10.7121],[105.3424,10.6875],[105.3394,10.6826],[105.3363,10.6731],[105.3382,10.6471],[105.348,10.6176],[105.3663,10.5785],[105.3697,10.574],[105.3753,10.5722],[105.3849,10.5722],[105.3925,10.5693],[105.408,10.5543],[105.4147,10.5511],[105.4375,10.5534],[105.4437,10.5553],[105.4489,10.5508],[105.4822,10.5341],[105.493,10.5436],[105.5172,10.5452],[105.5235,10.5419],[105.5303,10.5344],[105.536,10.5333],[105.5412,10.5305],[105.5478,10.5233],[105.5544,10.5134],[105.5686,10.4803],[105.5711,10.4707],[105.5739,10.449],[105.5712,10.4392],[105.5724,10.43],[105.5659,10.4299],[105.5527,10.4354],[105.5498,10.433],[105.542,10.4171],[105.5354,10.4168],[105.5302,10.4126],[105.5279,10.4102],[105.5279,10.4041],[105.5222,10.4051],[105.5202,10.4041],[105.5189,10.3994],[105.5225,10.389],[105.5235,10.3782],[105.5173,10.3719],[105.517,10.3648],[105.4906,10.3483],[105.4886,10.3455],[105.4896,10.3401],[105.4879,10.3335],[105.4951,10.326],[105.4857,10.3248],[105.4756,10.3129],[105.4247,10.3041],[105.4395,10.2707],[105.3977,10.2547],[105.3345,10.2354],[105.3099,10.2744],[105.3047,10.2701],[105.2992,10.2777],[105.2901,10.2677],[105.2869,10.2607],[105.2654,10.2399],[105.2591,10.2469],[105.2547,10.2427],[105.2455,10.2317],[105.224,10.202],[105.2762,10.16],[105.2989,10.1369],[105.3098,10.148],[105.3508,10.1015],[105.355,10.0834],[105.3628,10.0742],[105.3979,10.0435],[105.5383,9.913],[105.5189,9.8707],[105.517,9.863],[105.5187,9.8601],[105.4751,9.8334],[105.4434,9.8206],[105.429,9.8167],[105.4331,9.7951],[105.4325,9.7924],[105.4287,9.7894],[105.4219,9.7806],[105.4198,9.7805],[105.4161,9.7825],[105.4135,9.7819],[105.4128,9.7799],[105.4151,9.7759],[105.4141,9.774],[105.4058,9.7746],[105.4037,9.7718],[105.4052,9.762],[105.4112,9.7621],[105.4127,9.7607],[105.4136,9.7563],[105.4118,9.7522],[105.4091,9.7506],[105.4025,9.7508],[105.3917,9.7458],[105.3908,9.7394],[105.3892,9.7373],[105.3867,9.7357],[105.3753,9.7331],[105.371,9.7306],[105.3563,9.7144],[105.3398,9.7057],[105.3297,9.7037],[105.3265,9.7015],[105.327,9.6991],[105.3319,9.6943],[105.3359,9.6876],[105.3356,9.682],[105.3374,9.6771],[105.3548,9.6697],[105.3709,9.6733],[105.3722,9.6724],[105.372,9.6703],[105.3668,9.6635],[105.3688,9.66],[105.3955,9.6576],[105.4035,9.653],[105.4047,9.6517],[105.4048,9.6446],[105.3972,9.6312],[105.3976,9.623],[105.3901,9.6254],[105.3875,9.629],[105.3822,9.6211],[105.374,9.6136],[105.3735,9.6009],[105.372,9.5973],[105.3706,9.5982],[105.3647,9.5937],[105.3608,9.5935],[105.3552,9.5942],[105.3474,9.5991],[105.3405,9.6134],[105.3383,9.6134],[105.3333,9.6083],[105.329,9.6057],[105.3223,9.6056],[105.3086,9.6094],[105.3062,9.6116],[105.3026,9.6187],[105.3023,9.6287],[105.3008,9.6303],[105.2957,9.6315],[105.2935,9.6376],[105.2889,9.6344],[105.2863,9.63],[105.2847,9.6177],[105.286,9.6068],[105.2896,9.5935],[105.2923,9.5884],[105.2994,9.5808],[105.3085,9.574],[105.3089,9.5711],[105.3054,9.5618],[105.3054,9.5599],[105.3073,9.5568],[105.3165,9.5604],[105.3222,9.5597],[105.3225,9.5564],[105.3207,9.55],[105.3216,9.5422],[105.3239,9.5351],[105.3286,9.529],[105.321,9.5163],[105.318,9.5135],[105.3072,9.5077],[105.2977,9.5074],[105.2956,9.5032],[105.2885,9.4578],[105.2935,9.4337],[105.3008,9.4253],[105.3071,9.4156],[105.3131,9.3985],[105.3175,9.3843],[105.3127,9.3844],[105.3056,9.389],[105.2992,9.3914],[105.295,9.3922],[105.293,9.3892],[105.2761,9.3998],[105.273,9.3959],[105.2576,9.4011],[105.1488,9.4705],[105.0701,9.5167],[105.0015,9.5594],[104.9977,9.5479],[104.9896,9.5406],[104.9761,9.5443],[104.9675,9.55],[104.961,9.5565],[104.9441,9.5334],[104.9145,9.5623],[104.8795,9.4951],[104.8734,9.5016],[104.8543,9.5172],[104.8441,9.5303],[104.8337,9.5336],[104.8384,9.5883],[104.8474,9.6613],[104.8565,9.7228],[104.8654,9.7533],[104.8729,9.7726],[104.8854,9.8303],[104.8918,9.8437],[104.8955,9.849],[104.9006,9.8522],[104.9093,9.852],[104.918,9.8486],[104.9279,9.8484],[104.9454,9.8514],[104.9529,9.8547],[104.9635,9.8621],[104.9817,9.8844],[105.017,9.9227],[105.0392,9.9398],[105.0506,9.947],[105.0621,9.9514],[105.0712,9.9516],[105.0775,9.9489],[105.0989,9.9582],[105.0791,10.0012],[105.0729,10.0118],[105.0484,10.0391],[104.9989,10.0893],[104.9905,10.0994],[104.9644,10.0999],[104.9537,10.0986],[104.9099,10.0887],[104.8974,10.0873],[104.8918,10.0875],[104.8828,10.0908],[104.875,10.0966],[104.8662,10.1072],[104.8307,10.1622],[104.8193,10.178],[104.8078,10.1914],[104.7946,10.2035],[104.7811,10.2121],[104.7688,10.218],[104.7416,10.2268],[104.7293,10.227],[104.722,10.2244],[104.6978,10.2106],[104.6839,10.1992],[104.6503,10.1573],[104.6449,10.1479],[104.6429,10.1386],[104.6383,10.1377],[104.6297,10.145],[104.6192,10.1477],[104.6125,10.1475],[104.6035,10.144],[104.599,10.1449],[104.5978,10.1484],[104.6058,10.1565],[104.6081,10.1606],[104.6079,10.164],[104.6019,10.1723],[104.588,10.1869],[104.5881,10.1886],[104.5937,10.1903],[104.5948,10.1928],[104.5938,10.1969],[104.5884,10.2013],[104.5837,10.2078],[104.5839,10.2102],[104.5884,10.2131],[104.5904,10.2162],[104.5883,10.23],[104.5819,10.2501],[104.5773,10.2597],[104.5685,10.2733],[104.5566,10.286],[104.5502,10.2902],[104.5455,10.2914],[104.542,10.2906],[104.5316,10.2786],[104.5286,10.2802],[104.5269,10.2942],[104.5277,10.3168],[104.5251,10.3247],[104.5122,10.3439],[104.4966,10.3616],[104.4884,10.3679],[104.4816,10.3777],[104.4659,10.3742],[104.4432,10.3652],[104.4408,10.3661],[104.4403,10.3681],[104.4445,10.3878],[104.4457,10.3912],[104.45,10.3965],[104.4507,10.4009],[104.4459,10.4133],[104.437,10.4241],[104.4766,10.4325],[104.4871,10.4219],[104.4914,10.411],[104.4962,10.4056],[104.5064,10.4212],[104.5166,10.4413],[104.5263,10.4478],[104.5411,10.4491],[104.5501,10.4576],[104.5536,10.4641],[104.5565,10.4743],[104.5581,10.4938],[104.5689,10.5],[104.5806,10.5045],[104.583,10.5071],[104.5854,10.511],[104.5859,10.5268],[104.5869,10.5298],[104.5955,10.5351],[104.6013,10.5356],[104.6061,10.5343],[104.6147,10.5294],[104.6329,10.5309],[104.6369,10.5325],[104.6444,10.5319],[104.6441,10.5409],[104.6889,10.539],[104.7134,10.5329]]];

// Khung nhìn ban đầu: vừa khít An Giang (từ Thổ Châu đến Tân Châu)
const AN_GIANG_VIEW: [[number, number], [number, number]] = [
  [9.2, 103.35],
  [11.0, 105.65],
];

// --- COMPONENT BẢN ĐỒ DU LỊCH AN GIANG (LEAFLET + OPENSTREETMAP MIỄN PHÍ) ---
function InteractiveAnGiangMap({
  places,
  plannerPlaces,
  transitHubs,
  userLocation,
  onSelectPlace,
  onGoToPlanner,
  onLocateMe,
}: {
  places: PlaceItem[];
  plannerPlaces: PlaceItem[];
  transitHubs: TransitHub[];
  userLocation: { lat: number; lng: number; label: string };
  onSelectPlace: (p: PlaceItem) => void;
  onGoToPlanner: () => void;
  onLocateMe: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const [visibleTabs, setVisibleTabs] = useState<Record<string, boolean>>({
    THAM_QUAN: true,
    AM_THUC: false,
    MUA_SAM: false,
    NHA_NGHI: false,
    LE_HOI: false,
  });
  const [visibleHubs, setVisibleHubs] = useState<Record<HubType, boolean>>({
    ferry: true,
    bus: true,
    airport: true,
  });
  const [leafletReady, setLeafletReady] = useState<boolean>(false);

  // Tự động nạp thư viện Leaflet từ CDN (Không cần cài thêm gói hay API Key)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("leaflet-css-cdn")) {
      const link = document.createElement("link");
      link.id = "leaflet-css-cdn";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if ((window as any).L) {
      setLeafletReady(true);
      return;
    }

    const existingScript = document.getElementById("leaflet-js-cdn");
    if (existingScript) {
      existingScript.addEventListener("load", () => setLeafletReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js-cdn";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setLeafletReady(true);
    document.body.appendChild(script);
  }, []);

  // Khởi tạo khung bản đồ
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      zoomSnap: 0.25,
    });
    map.fitBounds(AN_GIANG_VIEW); // Mở lên là thấy trọn An Giang, vẫn kéo/zoom tự do

    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi", {
      attribution: '&copy; Google Maps & <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
    }).addTo(map);

    // Phủ xám toàn bộ khu vực NGOÀI An Giang: hình chữ nhật cả thế giới, khoét "lỗ" theo ranh giới An Giang
    const worldRing = [
      [-85, -180],
      [-85, 180],
      [85, 180],
      [85, -180],
    ];
    const holes = AN_GIANG_RINGS.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
    L.polygon([worldRing, ...holes], {
      stroke: false,
      fillColor: "#475569",
      fillOpacity: 0.6,
      interactive: false, // Không cản click vào bản đồ
    }).addTo(map);

    // Viền ranh giới An Giang
    L.polygon(holes, {
      color: "#0f766e",
      weight: 2,
      fill: false,
      interactive: false,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletReady]);

  // Vẽ các điểm ghim (Điểm đến, Lưu trú, Bến tàu/Bến xe/Sân bay & Đường nối lộ trình)
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !layerGroupRef.current) return;
    const L = (window as any).L;
    const group = layerGroupRef.current;
    group.clearLayers();

    // 1. Vẽ điểm đến theo từng loại đã bật (Tham quan, Ẩm thực, Mua sắm, Nhà nghỉ, Lễ hội)
    places
      .filter((p) => p.isVisible && visibleTabs[p.tab])
      .forEach((p) => {
        let icon: any;
        let tip: string;
        if (p.tab === "THAM_QUAN") {
          const cat = getPlaceMapCategory(p);
          icon = L.divIcon({
            className: "custom-dot-marker",
            html: `<div style="width:14px;height:14px;border-radius:9999px;background:${cat.color};border:2.5px solid #ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.35);cursor:pointer;"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          tip = `<b>${p.name}</b><br/>${p.region} • ${cat.label}`;
        } else {
          const layer = MAP_PLACE_LAYERS.find((l) => l.tab === p.tab);
          icon = L.divIcon({
            className: "custom-layer-marker",
            html: `<div style="width:22px;height:22px;border-radius:6px;background:${layer?.color || "#0f766e"};color:#ffffff;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;">${layer?.symbol || "📍"}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          tip = `<b>${p.name}</b><br/>${layer?.label || ""} • ${p.region}`;
        }
        const marker = L.marker([p.latitude, p.longitude], { icon });
        marker.bindTooltip(tip, { direction: "top", offset: [0, -8] });
        marker.on("click", () => onSelectPlace(p));
        marker.addTo(group);
      });

    // 2. Vẽ Bến tàu, Bến xe, Sân bay (dữ liệu nhập từ Excel + mặc định)
    transitHubs
      .filter((hub) => visibleHubs[hub.type])
      .forEach((hub) => {
        const symbol = HUB_META[hub.type].symbol;
        const icon = L.divIcon({
          className: "custom-hub-marker",
          html: `<div style="width:24px;height:24px;border-radius:6px;background:#0f172a;color:#ffffff;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${symbol}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([hub.lat, hub.lng], { icon });
        marker.bindPopup(
          `<div style="font-size:12px;"><b>${hub.name}</b><br/><span style="color:#0f766e;font-weight:600;">${HUB_META[hub.type].label}</span>${
            hub.note ? `<br/><span style="color:#475569;">${hub.note}</span>` : ""
          }</div>`
        );
        marker.addTo(group);
      });

    // 4. Vẽ đường nối Lộ trình hành trình đang lập (nếu có)
    if (plannerPlaces.length > 1) {
      const latlngs = plannerPlaces.map((p) => [p.latitude, p.longitude]);
      L.polyline(latlngs, {
        color: "#047857",
        weight: 3,
        dashArray: "6, 6",
        opacity: 0.85,
      }).addTo(group);
    }
  }, [leafletReady, places, plannerPlaces, transitHubs, visibleTabs, visibleHubs, onSelectPlace]);

  const handleFlyToMyLocation = () => {
    onLocateMe();
    if (mapInstanceRef.current && (window as any).L) {
      const L = (window as any).L;
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 12, { duration: 1.2 });
      L.popup()
        .setLatLng([userLocation.lat, userLocation.lng])
        .setContent(`<b>📍 Vị trí của bạn</b><br/>${userLocation.label}`)
        .openOn(mapInstanceRef.current);
    }
  };

  return (
    <div className="bg-[#FAF8F5]/95 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-3xl shadow-xl border border-white space-y-6">
      {/* Tiêu đề chuẩn hình mẫu */}
      <div className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
          Bản đồ du lịch An Giang
        </h2>
        <p className="text-xs md:text-sm text-slate-500">
          Bản đồ các điểm đến, cơ sở lưu trú và bến tàu ở An Giang, kèm lộ trình hành trình đang lập.
        </p>
      </div>

      {/* Bố cục 2 cột: Trái là Bản đồ Leaflet, Phải là 3 thẻ điều khiển */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Khung Bản đồ bên trái */}
        <div className="lg:col-span-8 h-[380px] sm:h-[480px] md:h-[540px] rounded-3xl overflow-hidden border border-slate-200/80 shadow-inner bg-[#E5E7EB] relative z-10">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Cột điều khiển bên phải chuẩn hình mẫu */}
        <div className="lg:col-span-4 space-y-4">
          {/* Thẻ 1: Bộ lọc lớp bản đồ + Nút Vị trí của tôi */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <p className="text-[11px] font-bold uppercase text-slate-400">Điểm đến</p>
            {MAP_PLACE_LAYERS.map((layer) => {
              const count = places.filter((p) => p.isVisible && p.tab === layer.tab).length;
              return (
                <label
                  key={layer.tab}
                  className="flex items-center gap-3 text-sm font-medium text-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!visibleTabs[layer.tab]}
                    onChange={(e) =>
                      setVisibleTabs((prev) => ({ ...prev, [layer.tab]: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#047857] rounded cursor-pointer"
                  />
                  <span>
                    {layer.symbol} {layer.label}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">{count}</span>
                </label>
              );
            })}

            <p className="text-[11px] font-bold uppercase text-slate-400 pt-1">Giao thông</p>
            {(["ferry", "bus", "airport"] as HubType[]).map((type) => (
              <label
                key={type}
                className="flex items-center gap-3 text-sm font-medium text-slate-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleHubs[type]}
                  onChange={(e) =>
                    setVisibleHubs((prev) => ({ ...prev, [type]: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#047857] rounded cursor-pointer"
                />
                <span>
                  {HUB_META[type].symbol} {HUB_META[type].label}
                </span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {transitHubs.filter((h) => h.type === type).length}
                </span>
              </label>
            ))}

            <div className="pt-1">
              <button
                type="button"
                onClick={handleFlyToMyLocation}
                className="w-full py-2 px-4 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Vị trí của tôi
              </button>
            </div>
          </div>

          {/* Thẻ 2: Bảng chú thích màu theo loại hình */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">
              Màu điểm Tham quan
            </p>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0284c7] shrink-0" />
                <span>Biển đảo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#16a34a] shrink-0" />
                <span>Sinh thái</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#b45309] shrink-0" />
                <span>Lịch sử</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#9333ea] shrink-0" />
                <span>Văn hóa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#dc2626] shrink-0" />
                <span>Tâm linh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0d9488] shrink-0" />
                <span>Cộng đồng</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <span className="w-3 h-3 rounded-full bg-[#db2777] shrink-0" />
                <span>Vui chơi giải trí</span>
              </div>
            </div>
          </div>

          {/* Thẻ 3: Lộ trình hành trình */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Lộ trình hành trình</h3>
            {plannerPlaces.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có điểm nào trong hành trình.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs text-slate-700">
                {plannerPlaces.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={onGoToPlanner}
              className="w-full py-2.5 px-4 rounded-full bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm transition cursor-pointer"
            >
              Hành trình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- MÀN HÌNH CHỜ KHI MỚI VÀO WEB (hiện đến khi tải xong dữ liệu) ---
function LoadingScreen({ error }: { error: boolean }) {
  const [slow, setSlow] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-sky-700 via-teal-700 to-emerald-700 text-white px-6 text-center select-none">
      <div className="relative w-28 h-28">
        <div className="absolute inset-0 rounded-full border-4 border-white/20" />
        {!error && (
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-300 animate-spin" />
        )}
        <div className="absolute inset-3 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
          <Compass className={`w-12 h-12 text-white ${error ? "" : "animate-pulse"}`} />
        </div>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide drop-shadow">
          SỔ TAY DU LỊCH AN GIANG
        </h1>
        {error ? (
          <p className="text-sm text-amber-200 font-semibold">
            Không tải được dữ liệu. Vui lòng kiểm tra kết nối mạng rồi thử lại.
          </p>
        ) : (
          <p className="text-sm text-sky-100 font-medium">
            Đang tải dữ liệu du lịch, vui lòng chờ trong giây lát...
          </p>
        )}
        {!error && slow && (
          <p className="text-xs text-amber-200">
            Kết nối đang chậm hơn bình thường, bạn vui lòng chờ thêm nhé!
          </p>
        )}
      </div>

      {error && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-full bg-white text-teal-800 font-bold text-sm shadow-lg hover:bg-amber-100 transition cursor-pointer"
        >
          Tải lại trang
        </button>
      )}
    </div>
  );
}

export default function AnGiangTravelGuideApp() {
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [quickRegionFilter, setQuickRegionFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<FunctionalTab>("HOME");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // --- VOICE SEARCH (TÌM KIẾM BẰNG GIỌNG NÓI TIẾNG VIỆT) ---
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const handleToggleVoiceSearch = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceNotice(null);
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice("Trình duyệt chưa hỗ trợ nhận diện giọng nói.");
      setTimeout(() => setVoiceNotice(null), 3000);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice("Đang nghe... Hãy nói 'Trà Sư', 'Núi Sam', 'Bún cá'...");
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setSearchQuery(transcript);
          if (activeTab === "HOME") setActiveTab("THAM_QUAN");
          setVoiceNotice(`Đã nhận diện: "${transcript}"`);
          setTimeout(() => setVoiceNotice(null), 2500);
        }
      };
      recognition.onerror = () => {
        setIsListening(false);
        setVoiceNotice("Chưa nghe rõ, vui lòng thử lại!");
        setTimeout(() => setVoiceNotice(null), 2500);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // --- DỮ LIỆU ĐỌC 100% TỪ FILE shared-travel-data.json ---
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [allRegionLabel, setAllRegionLabel] = useState<string>("Tất cả khu vực");
  const [tabLabels, setTabLabels] = useState<Record<string, string>>({
    THAM_QUAN: "Tham Quan",
    BAN_DO: "Bản đồ",
    AM_THUC: "Ẩm thực",
    NHA_NGHI: "Nhà nghỉ",
    MUA_SAM: "Mua sắm",
    LE_HOI: "Lễ hội",
    OCOP: "Sản phẩm OCOP",
    HANH_TRINH: "Hành trình",
    CAM_NANG: "Cẩm nang",
  });

  const [transitHubs, setTransitHubs] = useState<TransitHub[]>(DEFAULT_TRANSIT_HUBS);
  const [newRegionName, setNewRegionName] = useState<string>("");
  const [newRegionDisplay, setNewRegionDisplay] = useState<string>("");
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);

  // --- TÀI KHOẢN, YÊU THÍCH, ĐÁNH GIÁ & CHUYẾN ĐI ĐÃ LƯU ---
  const [isStorageLoaded, setIsStorageLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const isAdminAuthenticated = currentUser?.role === "ADMIN";

  // Công tắt TOÀN HỆ THỐNG (chỉ Admin bật/tắt, lưu chung trong dữ liệu đồng bộ):
  // bật = người dùng không thấy các địa điểm chưa có ảnh. Admin vẫn thấy hết để bổ sung ảnh.
  const hideNoImage = tabLabels.HIDE_NO_IMAGE === "1";
  const toggleHideNoImage = () =>
    setTabLabels((prev) => ({ ...prev, HIDE_NO_IMAGE: prev.HIDE_NO_IMAGE === "1" ? "0" : "1" }));
  const publicPlaces = useMemo(
    () => (hideNoImage && !isAdminAuthenticated ? places.filter((p) => !isMissingImage(p)) : places),
    [places, hideNoImage, isAdminAuthenticated]
  );

  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTripItem[]>([]);
  const [tripTitle, setTripTitle] = useState<string>("Chuyến đi khám phá An Giang");
  const [saveTripSuccess, setSaveTripSuccess] = useState<boolean>(false);

  const [reviews, setReviews] = useState<UserReviewItem[]>([]);
  const [reviewAuthor, setReviewAuthor] = useState<string>("");
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");

  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [showMobileMore, setShowMobileMore] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  const [regUsername, setRegUsername] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regError, setRegError] = useState<string>("");

  // --- ĐỊNH VỊ GPS & OSRM ---
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; label: string }>({
    lat: 10.0125,
    lng: 105.0809,
    label: "Rạch Giá, An Giang",
  });
  const [roadRoutes, setRoadRoutes] = useState<
    Record<string, { distanceKm: number; durationMinutes: number }>
  >({});

  // --- TRANG CHI TIẾT ĐỊA ĐIỂM (địa chỉ dạng #place-<id>, nút Back của trình duyệt dùng được) ---
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null;
    const p = places.find((x) => x.id === selectedPlaceId);
    if (!p) return null;
    const osrm = roadRoutes[p.id];
    const fallbackDist = haversineKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude);
    return {
      ...p,
      distanceKm: osrm ? osrm.distanceKm : fallbackDist,
      durationMinutes: osrm
        ? osrm.durationMinutes
        : Math.max(3, Math.round((fallbackDist / 35) * 60)),
    };
  }, [selectedPlaceId, places, roadRoutes, userLocation]);

  const openPlace = (id: string) => {
    setSelectedPlaceId(id);
    if (typeof window !== "undefined") {
      window.location.hash = `place-${encodeURIComponent(id)}`;
    }
  };

  const closePlace = () => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#place-")) {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setSelectedPlaceId(null);
      }
    } else {
      setSelectedPlaceId(null);
    }
  };

  // Giữ tên cũ để các chỗ khác trong code (thẻ địa điểm, bản đồ) vẫn gọi được
  const setSelectedPlace = (p: { id: string } | null) => {
    if (p) openPlace(p.id);
    else closePlace();
  };

  // Đồng bộ với địa chỉ trên thanh trình duyệt (mở thẳng link #place-..., bấm Back/Forward)
  useEffect(() => {
    const sync = () => {
      const m = window.location.hash.match(/^#place-(.+)$/);
      setSelectedPlaceId(m ? decodeURIComponent(m[1]) : null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Chuyển tab hoặc đổi khu vực thì thoát khỏi trang chi tiết
  useEffect(() => {
    if (selectedPlaceId) closePlace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedRegion]);

  // Đổi tab thì luôn đưa trang về đầu (không giữ vị trí đã cuộn xuống của tab trước)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeTab]);

  // Địa điểm gần đây (khoảng cách đường chim bay từ tọa độ địa điểm đang xem)
  const nearbyData = useMemo(() => {
    if (!selectedPlace) return null;
    const others = publicPlaces
      .filter((p) => p.isVisible && p.id !== selectedPlace.id)
      .map((p) => ({
        place: p,
        km: haversineKm(selectedPlace.latitude, selectedPlace.longitude, p.latitude, p.longitude),
      }))
      .sort((a, b) => a.km - b.km);
    const pick = (tabs: FunctionalTab[]) =>
      others.filter((o) => tabs.includes(o.place.tab)).slice(0, 6);
    return {
      sights: pick(["THAM_QUAN", "LE_HOI", "MUA_SAM"]),
      food: pick(["AM_THUC"]),
      stay: pick(["NHA_NGHI"]),
    };
  }, [publicPlaces, selectedPlace]);

  const renderNearbySection = (
    title: string,
    emoji: string,
    items: { place: PlaceItem; km: number }[],
    emptyText: string
  ) => (
    <div className="border-t border-slate-200 pt-4 space-y-3">
      <h4 className="font-bold text-sm text-slate-900">
        {emoji} {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}</p>
      ) : (
        <HorizontalDragScroll>
          {items.map(({ place, km }, idx) => (
            <button
              key={place.id}
              type="button"
              onClick={() => openPlace(place.id)}
              style={{ animationDelay: `${Math.min(idx, 8) * 70}ms` }}
              className="ag-card-in group flex flex-col text-left rounded-2xl bg-white border border-slate-200 hover:border-teal-400 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer w-72 sm:w-80 shrink-0 snap-start overflow-hidden"
            >
              {/* Ảnh: phóng nhẹ khi rê chuột, có lớp mờ đen phía dưới để chữ nổi rõ */}
              <div className="relative h-40 sm:h-44 overflow-hidden bg-slate-200">
                <img
                  src={place.imageUrl}
                  alt={place.name}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
                <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-extrabold text-amber-600 shadow">
                  ★ {normalizeRating(place.rating)}
                </span>
                <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-teal-600/90 backdrop-blur text-xs font-bold text-white shadow">
                  📍 {formatApproxKm(km)} từ đây
                </span>
              </div>
              <div className="min-w-0 p-3.5 space-y-1">
                <p className="font-bold text-base text-slate-900 line-clamp-2 transition-colors group-hover:text-teal-700">
                  {place.name}
                </p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">
                  {place.region} • {place.subCategory} {place.badgeIcon}
                </p>
                {place.tab === "AM_THUC" && getFoodPriceText(place) && (
                  <p className="text-sm text-amber-800 font-semibold truncate">
                    🍴 {getFoodPriceText(place)}
                  </p>
                )}
                {place.tab === "NHA_NGHI" && (
                  <p className="text-sm text-amber-800 font-semibold truncate">
                    💰 {getStayPriceText(place)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </HorizontalDragScroll>
      )}
    </div>
  );

  // --- Đồng bộ dữ liệu dùng chung (nhiều người sửa cùng lúc) ---
  const syncedRef = useRef<SharedState | null>(null); // bản server gần nhất mà trình duyệt này biết
  const versionRef = useRef<number>(0);
  const savingRef = useRef(false);
  const saveAgainRef = useRef(false);
  const latestRef = useRef<SharedState | null>(null);
  latestRef.current = {
    places,
    regions,
    allRegionLabel,
    tabLabels,
    users,
    reviews,
    savedTrips,
    transitHubs,
  };

  // Chuyển dữ liệu thô từ server thành dạng dùng trong giao diện (có gộp khu vực trùng)
  const toLocalState = (data: any): SharedState => {
    const cur = latestRef.current!;
    const arr = (v: any, fallback: any[]) => (Array.isArray(v) ? v : fallback);
    const merged = mergeRegionsAndPlaces(arr(data.regions, []), arr(data.places, []));
    return {
      places: Array.isArray(data.places) ? merged.places : cur.places,
      regions: merged.regions,
      users: arr(data.users, cur.users),
      reviews: arr(data.reviews, cur.reviews),
      savedTrips: arr(data.savedTrips, cur.savedTrips),
      transitHubs: arr(data.transitHubs, cur.transitHubs),
      allRegionLabel: data.allRegionLabel || cur.allRegionLabel,
      tabLabels: { ...(cur.tabLabels || {}), ...(data.tabLabels || {}) },
    };
  };

  // Nhận bản mới từ server: GIỮ các thay đổi chưa lưu của mình rồi đặt chồng lên bản server
  // baseOverride = trạng thái mình vừa gửi đi (dùng sau khi lưu xong)
  const applyServerState = (raw: any, baseOverride?: SharedState) => {
    const incoming = toLocalState(raw);
    const base = baseOverride ?? syncedRef.current;
    const pending = base && latestRef.current ? diffState(base, latestRef.current) : null;
    const next = pending ? applyStateDelta(incoming, pending) : incoming;

    syncedRef.current = incoming;
    versionRef.current = raw.version ?? 0;

    setPlaces(next.places);
    setRegions(next.regions);
    setUsers(next.users);
    setReviews(next.reviews);
    setSavedTrips(next.savedTrips);
    setTransitHubs(next.transitHubs);
    if (next.allRegionLabel) setAllRegionLabel(next.allRegionLabel);
    if (next.tabLabels) setTabLabels(next.tabLabels);
  };

  // 1. Tải dữ liệu lần đầu từ /api/state
  useEffect(() => {
    let isMounted = true;
    async function loadSharedServerData() {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error("Không thể đọc /api/state");
        const data = await res.json();

        if (isMounted) {
          if (data) {
            applyServerState(data);
          } else {
            // Server chưa có file: coi như bản gốc là dữ liệu mặc định hiện tại
            syncedRef.current = { ...latestRef.current! };
          }
        }

        const localTrips = localStorage.getItem("ag_saved_trips_v2");
        if (isMounted && localTrips && (!data || !Array.isArray(data.savedTrips))) {
          setSavedTrips(JSON.parse(localTrips));
        }
        const savedCurrentUser = localStorage.getItem("ag_current_user_v2");
        if (isMounted && savedCurrentUser) setCurrentUser(JSON.parse(savedCurrentUser));
        const savedFavs = localStorage.getItem("ag_favorites_v2");
        if (isMounted && savedFavs) setFavorites(JSON.parse(savedFavs));

        if (isMounted) setIsStorageLoaded(true);
      } catch (err) {
        console.error("Lỗi tải dữ liệu từ shared-travel-data.json:", err);
        if (isMounted) setLoadError(true);
      }
    }
    loadSharedServerData();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // 2a. Thông tin riêng của từng người (đăng nhập, yêu thích) chỉ lưu trong trình duyệt, KHÔNG gửi lên server
  useEffect(() => {
    if (!isStorageLoaded) return;
    try {
      if (currentUser) {
        localStorage.setItem("ag_current_user_v2", JSON.stringify(currentUser));
      } else {
        localStorage.removeItem("ag_current_user_v2");
      }
      localStorage.setItem("ag_favorites_v2", JSON.stringify(favorites));
      localStorage.setItem("ag_saved_trips_v2", JSON.stringify(savedTrips));
    } catch {}
  }, [isStorageLoaded, currentUser, favorites, savedTrips]);

  // 2. Lưu: chỉ gửi phần thay đổi so với bản server gần nhất
  const saveNow = async () => {
    if (savingRef.current) {
      saveAgainRef.current = true; // đang lưu dở, lưu tiếp sau để không bị đảo thứ tự
      return;
    }
    const base = syncedRef.current;
    const cur = latestRef.current;
    if (!base || !cur) return;
    const delta = diffState(base, cur);
    if (!delta) return;

    savingRef.current = true;
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: delta }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.state) applyServerState({ ...json.state, version: json.version }, cur);
      } else {
        console.error("Server lưu dữ liệu không thành công:", res.status);
      }
    } catch (err) {
      console.error("Lỗi lưu dữ liệu lên Server:", err);
    } finally {
      savingRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        saveNow();
      }
    }
  };

  useEffect(() => {
    if (!isStorageLoaded) return;
    const timer = setTimeout(saveNow, 800); // gộp các thay đổi liên tiếp
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStorageLoaded, places, regions, allRegionLabel, tabLabels, users, reviews, savedTrips, transitHubs]);

  // 3. Thấy thay đổi của người khác: hỏi server mỗi 5 giây (rất nhẹ nhờ ?since=version)
  useEffect(() => {
    if (!isStorageLoaded) return;
    const poll = async () => {
      if (document.visibilityState !== "visible" || savingRef.current) return;
      try {
        const res = await fetch(`/api/state?since=${versionRef.current}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data && !data.unchanged && (data.version ?? 0) !== versionRef.current) {
          applyServerState(data);
        }
      } catch {}
    };
    const timer = setInterval(poll, 5000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStorageLoaded]);

  // 2b. Sao lưu thêm 1 bản dữ liệu phụ (thư mục "backups"): khi mở web, khi tắt/rời web và mỗi 10 phút
  useEffect(() => {
    if (!isStorageLoaded) return;
    const sendBackup = (reason: string) => {
      try {
        const payload = JSON.stringify({ reason });
        const ok =
          typeof navigator.sendBeacon === "function" &&
          navigator.sendBeacon("/api/backup", new Blob([payload], { type: "application/json" }));
        if (!ok) {
          fetch("/api/backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    sendBackup("open");
    const onHide = () => {
      if (document.visibilityState === "hidden") sendBackup("close");
    };
    const onPageHide = () => sendBackup("close");
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    const timer = setInterval(() => sendBackup("auto"), 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      clearInterval(timer);
    };
  }, [isStorageLoaded]);

  // Lấy lại vị trí GPS theo yêu cầu (dùng cho nút "Địa điểm gần đây"); trả về true nếu lấy được
  const requestGps = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4)),
            label: "Vị trí GPS hiện tại",
          });
          resolve(true);
        },
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4)),
            label: "Vị trí GPS hiện tại",
          });
        },
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadRealRoadDistances() {
      if (places.length === 0) return;
      try {
        const coordsList = [
          `${userLocation.lng},${userLocation.lat}`,
          ...places.map((p) => `${p.longitude},${p.latitude}`),
        ].join(";");
        const url = `https://router.project-osrm.org/table/v1/driving/${coordsList}?sources=0&annotations=distance,duration`;
        const res = await fetch(url);
        const data = await res.json();

        if (isMounted && data.code === "Ok" && data.distances?.[0] && data.durations?.[0]) {
          const nextRoutes: Record<string, { distanceKm: number; durationMinutes: number }> = {};
          places.forEach((p, idx) => {
            const distMeters = data.distances[0][idx + 1];
            const durSeconds = data.durations[0][idx + 1];
            if (typeof distMeters === "number" && typeof durSeconds === "number") {
              nextRoutes[p.id] = {
                distanceKm: Number((distMeters / 1000).toFixed(1)),
                durationMinutes: Math.max(1, Math.round(durSeconds / 60)),
              };
            }
          });
          setRoadRoutes(nextRoutes);
        }
      } catch {}
    }
    loadRealRoadDistances();
    return () => {
      isMounted = false;
    };
  }, [userLocation, places]);

  // --- ĐĂNG KÝ & ĐĂNG NHẬP ---
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = regUsername.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanUser || !cleanEmail || !regPassword) {
      setRegError("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    if (
      cleanUser.toLowerCase() === "admin" ||
      users.some(
        (u) =>
          u.username.toLowerCase() === cleanUser.toLowerCase() ||
          u.email.toLowerCase() === cleanEmail
      )
    ) {
      setRegError("Tên tài khoản hoặc Email này đã tồn tại!");
      return;
    }

    const newAccount: UserAccount = {
      username: cleanUser,
      email: cleanEmail,
      password: regPassword,
      role: "USER",
    };

    setUsers((prev) => [...prev, newAccount]);
    setCurrentUser(newAccount);
    setShowRegisterModal(false);
    setRegUsername("");
    setRegEmail("");
    setRegPassword("");
    setRegError("");
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = loginUsername.trim().toLowerCase();

    if (input === "admin" && loginPassword === "admin") {
      setCurrentUser({
        username: "Admin",
        email: "admin@angiang.vn",
        password: "",
        role: "ADMIN",
      });
      setShowLoginModal(false);
      setLoginError("");
      setLoginUsername("");
      setLoginPassword("");
      setActiveTab("ADMIN");
      return;
    }

    const matchedUser = users.find(
      (u) =>
        (u.username.toLowerCase() === input || u.email.toLowerCase() === input) &&
        u.password === loginPassword
    );

    if (matchedUser) {
      setCurrentUser(matchedUser);
      setShowLoginModal(false);
      setLoginError("");
      setLoginUsername("");
      setLoginPassword("");
      return;
    }

    setLoginError("Sai tên tài khoản/email hoặc mật khẩu!");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    if (activeTab === "ADMIN") {
      setActiveTab("HOME");
    }
  };

  const toggleFavoritePlace = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace || !reviewComment.trim()) return;
    const newRev: UserReviewItem = {
      id: `rev-${Date.now()}`,
      placeId: selectedPlace.id,
      authorName: reviewAuthor.trim() || currentUser?.username || "Du khách ẩn danh",
      rating: reviewRating,
      comment: reviewComment.trim(),
      createdAt: new Date().toLocaleDateString("vi-VN"),
    };
    setReviews((prev) => [newRev, ...prev]);
    setReviewComment("");
  };

  // Địa điểm chỉ thuộc tab đang mở (VD: tab Tham quan thì chỉ đếm địa điểm tham quan) - dùng để đếm trên các nút khu vực
  const tabScopedPlaces = useMemo(
    () =>
      ["HOME", "BAN_DO", "HANH_TRINH", "CAM_NANG", "ADMIN"].includes(activeTab)
        ? publicPlaces
        : publicPlaces.filter((p) => p.tab === activeTab),
    [publicPlaces, activeTab]
  );

  // --- LỌC ĐỊA ĐIỂM HỖ TRỢ TÌM KIẾM KHÔNG DẤU ---
  const filteredPlaces = useMemo(() => {
    return publicPlaces
      .filter((p) => p.isVisible)
      .map((p) => {
        const osrmData = roadRoutes[p.id];
        const fallbackDist = haversineKm(
          userLocation.lat,
          userLocation.lng,
          p.latitude,
          p.longitude
        );
        return {
          ...p,
          distanceKm: osrmData ? osrmData.distanceKm : fallbackDist,
          durationMinutes: osrmData
            ? osrmData.durationMinutes
            : Math.max(3, Math.round((fallbackDist / 35) * 60)),
        };
      })
      .filter((p) => {
        const matchRegion = selectedRegion === "ALL" || p.region === selectedRegion;
        const matchTab =
          activeTab === "HOME" ||
          activeTab === "HANH_TRINH" ||
          activeTab === "CAM_NANG" ||
          activeTab === "ADMIN"
            ? true
            : p.tab === activeTab;
        const matchQuery =
          !searchQuery.trim() ||
          matchesVietnameseSearch(p.name, searchQuery) ||
          matchesVietnameseSearch(p.englishName, searchQuery) ||
          matchesVietnameseSearch(p.address, searchQuery) ||
          matchesVietnameseSearch(p.region, searchQuery) ||
          matchesVietnameseSearch(p.subCategory, searchQuery) ||
          matchesVietnameseSearch(p.shortDesc, searchQuery) ||
          p.tags.some((t) => matchesVietnameseSearch(t, searchQuery));
        return matchRegion && matchTab && matchQuery;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [publicPlaces, roadRoutes, userLocation, selectedRegion, activeTab, searchQuery]);

  // =====================================================================
  // BỘ LẬP HÀNH TRÌNH & DỰ TOÁN CHI PHÍ XÁC ĐỊNH
  // =====================================================================
  const [plannerDestIds, setPlannerDestIds] = useState<string[]>([]);
  // Bộ lọc cho ô "Thêm điểm đến vào lộ trình": theo khu vực và loại hình
  const [plannerAddRegion, setPlannerAddRegion] = useState<string>("ALL");
  const [plannerAddTab, setPlannerAddTab] = useState<string>("ALL");
  const [isRoundTrip] = useState<boolean>(true);
  const [plannerDays, setPlannerDays] = useState<number>(2);
  const [adultCount, setAdultCount] = useState<number>(4);
  const [childCount, setChildCount] = useState<number>(0);
  const [vehicleType, setVehicleType] = useState<"personal_car" | "motorbike" | "rental_car">(
    "personal_car"
  );
  const [vehicleCount, setVehicleCount] = useState<number>(1);
  const [customRoadKm, setCustomRoadKm] = useState<number | null>(null);

  const [fuelConsumption, setFuelConsumption] = useState<number>(7);
  const [fuelPrice, setFuelPrice] = useState<number>(24500);
  const [tollFees, setTollFees] = useState<number>(80000);
  const [parkingFees, setParkingFees] = useState<number>(50000);
  const [rentalDailyPrice] = useState<number>(900000);
  const [adultFerryPrice] = useState<number>(340000);
  const [childFerryPrice] = useState<number>(240000);
  const [vehicleFerryFee] = useState<number>(150000);
  const [foodPerPersonDay, setFoodPerPersonDay] = useState<number>(250000);
  const [roomPricePerNight, setRoomPricePerNight] = useState<number>(800000);
  const [roomCount, setRoomCount] = useState<number>(2);
  const [contingencyPercent, setContingencyPercent] = useState<number>(10);
  const [expectedBudget, setExpectedBudget] = useState<number>(6000000);

  const selectedPlannerPlaces = useMemo(() => {
    return plannerDestIds
      .map((id) => places.find((p) => p.id === id))
      .filter((p): p is PlaceItem => Boolean(p));
  }, [plannerDestIds, places]);

  const routeSummary = useMemo(() => {
    let roadKm = 0;
    let waterKm = 0;
    let hasWaterCrossing = false;

    if (customRoadKm !== null) {
      roadKm = customRoadKm;
    } else {
      selectedPlannerPlaces.forEach((p, idx) => {
        const regInfo = regions.find((r) => r.name === p.region);
        if (regInfo?.isIsland) {
          hasWaterCrossing = true;
          waterKm += p.region === "Phú Quốc" ? 120 : p.region === "Kiên Hải" ? 83 : 198;
          roadKm += 18;
        } else {
          const dist =
            roadRoutes[p.id]?.distanceKm ??
            haversineKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude);
          roadKm += idx === 0 ? dist : Math.max(12, Math.round(dist * 0.45));
        }
      });
      if (isRoundTrip && roadKm > 0) roadKm = Math.round(roadKm * 1.6);
    }

    return {
      roadKm:
        selectedPlannerPlaces.length === 0 && customRoadKm === null
          ? 0
          : Math.max(10, Math.round(roadKm)),
      waterKm,
      hasWaterCrossing,
    };
  }, [selectedPlannerPlaces, regions, roadRoutes, userLocation, isRoundTrip, customRoadKm]);

  const costBreakdown = useMemo(() => {
    const totalPeople = Math.max(1, adultCount + childCount);
    const vCount = Math.max(1, vehicleCount);

    const fuelLitersPerVehicle = Number(
      ((routeSummary.roadKm * fuelConsumption) / 100).toFixed(2)
    );
    const fuelCostPerVehicle = Math.round(fuelLitersPerVehicle * fuelPrice);
    const totalFuelLiters = Number((fuelLitersPerVehicle * vCount).toFixed(2));
    const totalFuelCost = fuelCostPerVehicle * vCount;
    const totalTolls = tollFees * vCount;
    const totalParking = parkingFees * vCount;

    let roadTransportCost = totalFuelCost + totalTolls + totalParking;
    if (vehicleType === "rental_car") {
      roadTransportCost += rentalDailyPrice * plannerDays * vCount;
    }

    const ferryCost = routeSummary.hasWaterCrossing
      ? adultCount * adultFerryPrice + childCount * childFerryPrice + vehicleFerryFee * vCount
      : 0;

    const transportTotal = roadTransportCost + ferryCost;
    const foodTotal = foodPerPersonDay * plannerDays * totalPeople;
    const nights = Math.max(0, plannerDays - 1);
    const accommodationTotal = nights * roomPricePerNight * roomCount;
    const ticketTotal = selectedPlannerPlaces.reduce(
      (sum, p) => sum + (p.ticketPrice || 0) * totalPeople,
      0
    );

    const subTotal = transportTotal + foodTotal + accommodationTotal + ticketTotal;
    const contingencyCost = Math.round((subTotal * Math.max(0, contingencyPercent)) / 100);
    const grandTotal = subTotal + contingencyCost;
    const perPerson = Math.round(grandTotal / totalPeople);

    return {
      totalFuelLiters,
      totalFuelCost,
      totalTolls,
      totalParking,
      ferryCost,
      transportTotal,
      foodTotal,
      accommodationTotal,
      ticketTotal,
      contingencyCost,
      grandTotal,
      perPerson,
      difference: expectedBudget - grandTotal,
      isOverBudget: expectedBudget > 0 && grandTotal > expectedBudget,
    };
  }, [
    routeSummary,
    fuelConsumption,
    fuelPrice,
    tollFees,
    parkingFees,
    vehicleType,
    vehicleCount,
    rentalDailyPrice,
    plannerDays,
    adultCount,
    childCount,
    adultFerryPrice,
    childFerryPrice,
    vehicleFerryFee,
    foodPerPersonDay,
    roomPricePerNight,
    roomCount,
    selectedPlannerPlaces,
    contingencyPercent,
    expectedBudget,
  ]);

  // --- LẬP HÀNH TRÌNH 4 BƯỚC: NHU CẦU → ĐIỂM ĐẾN → CHI PHÍ → KẾT QUẢ ---
  const [plannerStep, setPlannerStep] = useState<1 | 2 | 3 | 4>(1);
  const [originName, setOriginName] = useState<string>("Rạch Giá");
  // Ngày đi mặc định (hôm nay + 7 ngày) được đặt trong useEffect, không đọc new Date() lúc render
  const [startDate, setStartDate] = useState<string>("");
  useEffect(() => {
    setStartDate((cur) => {
      if (cur) return cur;
      const d = new Date();
      d.setDate(d.getDate() + 7);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${m}-${day}`;
    });
  }, []);
  const [dayStartTime, setDayStartTime] = useState<string>("06:30");
  const [dayEndTime, setDayEndTime] = useState<string>("21:00");
  const [pace, setPace] = useState<PaceKind>("normal");
  const [roundTrip, setRoundTrip] = useState<boolean>(true);
  const [funShopCost, setFunShopCost] = useState<number>(600000);
  const [ticketOverride, setTicketOverride] = useState<number | null>(null);
  const [tripCopied, setTripCopied] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [aiPlan, setAiPlan] = useState<AiTripPlan | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiPrevOrder, setAiPrevOrder] = useState<string[] | null>(null);
  const aiNoteById = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    aiPlan?.days.forEach((d) => d.stops.forEach((s) => (m[s.placeId] = s.note)));
    return m;
  }, [aiPlan]);

  const originPt = useMemo<TripPt>(() => {
    const o = TRIP_ORIGINS.find((x) => x.name === originName) || TRIP_ORIGINS[0];
    return { lat: o.lat, lng: o.lng, name: o.name, island: o.island };
  }, [originName]);

  const schedule = useMemo<TripSchedule>(
    () =>
      buildTripSchedule({
        origin: originPt,
        stops: selectedPlannerPlaces,
        dayCount: Math.max(1, plannerDays),
        startMin: parseClock(dayStartTime, 390),
        endMin: parseClock(dayEndTime, 1260),
        pace,
        vehicle: vehicleType,
        roundTrip,
        startDate,
        allPlaces: places,
      }),
    [
      originPt,
      selectedPlannerPlaces,
      plannerDays,
      dayStartTime,
      dayEndTime,
      pace,
      vehicleType,
      roundTrip,
      startDate,
      places,
    ]
  );

  const autoTicketTotal = useMemo(() => {
    const people = Math.max(1, adultCount + childCount);
    return selectedPlannerPlaces.reduce((s, p) => s + (p.ticketPrice || 0) * people, 0);
  }, [selectedPlannerPlaces, adultCount, childCount]);

  const tripCost = useMemo(() => {
    const people = Math.max(1, adultCount + childCount);
    const v = Math.max(1, vehicleCount);
    const liters = Number(((schedule.roadKm * fuelConsumption) / 100 * v).toFixed(2));
    const fuel = Math.round(liters * fuelPrice);
    const rental = vehicleType === "rental_car" ? rentalDailyPrice * plannerDays * v : 0;
    const transport = fuel + tollFees * v + parkingFees * v + rental;
    const ferry =
      schedule.ferryCrossings * (adultCount * adultFerryPrice + childCount * childFerryPrice);
    const food = foodPerPersonDay * plannerDays * people;
    const nights = Math.max(0, plannerDays - 1);
    const lodging = nights * roomPricePerNight * roomCount;
    const tickets = ticketOverride ?? autoTicketTotal;
    const fun = funShopCost;
    const subTotal = transport + ferry + food + lodging + tickets + fun;
    const contingency = Math.round((subTotal * Math.max(0, contingencyPercent)) / 100);
    const grand = subTotal + contingency;
    return {
      liters,
      transport,
      ferry,
      food,
      nights,
      lodging,
      tickets,
      fun,
      contingency,
      grand,
      perPerson: Math.round(grand / people),
      people,
      diff: expectedBudget - grand,
      over: expectedBudget > 0 && grand > expectedBudget,
    };
  }, [
    schedule,
    adultCount,
    childCount,
    vehicleCount,
    vehicleType,
    fuelConsumption,
    fuelPrice,
    tollFees,
    parkingFees,
    rentalDailyPrice,
    plannerDays,
    adultFerryPrice,
    childFerryPrice,
    foodPerPersonDay,
    roomPricePerNight,
    roomCount,
    ticketOverride,
    autoTicketTotal,
    funShopCost,
    contingencyPercent,
    expectedBudget,
  ]);

  const vehicleLabel =
    vehicleType === "personal_car" ? "Ô tô cá nhân" : vehicleType === "motorbike" ? "Xe máy" : "Thuê ô tô";

  // Đóng gói toàn bộ lựa chọn của chuyến đi (dùng khi lưu và khi chia sẻ link)
  const buildTripPayload = (): SavedTripItem => ({
    id: `trip-${Date.now()}`,
    title: tripTitle.trim() || `Chuyến đi An Giang (${plannerDays} ngày)`,
    createdAt: new Date().toLocaleString("vi-VN"),
    owner: currentUser?.username || "Du khách",
    plannerDays,
    adultCount,
    childCount,
    vehicleType,
    vehicleCount,
    destIds: [...plannerDestIds],
    roadKm: schedule.roadKm,
    waterKm: schedule.ferryKm,
    totalCost: tripCost.grand,
    perPersonCost: tripCost.perPerson,
    originName,
    startDate,
    dayStartTime,
    dayEndTime,
    pace,
    roundTrip,
    ai: aiPlan ?? undefined,
    cost: {
      fuelConsumption,
      fuelPrice,
      tollFees,
      parkingFees,
      foodPerPersonDay,
      roomPricePerNight,
      roomCount,
      funShopCost,
      ticketOverride,
      contingencyPercent,
      expectedBudget,
    },
  });

  // Nạp lại một chuyến đi (đã lưu hoặc từ link chia sẻ) rồi mở thẳng trang kết quả
  const applyTrip = (trip: SavedTripItem) => {
    setTripTitle(trip.title);
    setPlannerDays(trip.plannerDays);
    setAdultCount(trip.adultCount);
    setChildCount(trip.childCount);
    setVehicleType(trip.vehicleType);
    setVehicleCount(trip.vehicleCount);
    setPlannerDestIds(trip.destIds);
    setCustomRoadKm(null);
    if (trip.originName) setOriginName(trip.originName);
    if (trip.startDate) setStartDate(trip.startDate);
    if (trip.dayStartTime) setDayStartTime(trip.dayStartTime);
    if (trip.dayEndTime) setDayEndTime(trip.dayEndTime);
    if (trip.pace) setPace(trip.pace);
    if (typeof trip.roundTrip === "boolean") setRoundTrip(trip.roundTrip);
    if (trip.cost) {
      setFuelConsumption(trip.cost.fuelConsumption);
      setFuelPrice(trip.cost.fuelPrice);
      setTollFees(trip.cost.tollFees);
      setParkingFees(trip.cost.parkingFees);
      setFoodPerPersonDay(trip.cost.foodPerPersonDay);
      setRoomPricePerNight(trip.cost.roomPricePerNight);
      setRoomCount(trip.cost.roomCount);
      setFunShopCost(trip.cost.funShopCost);
      setTicketOverride(trip.cost.ticketOverride);
      setContingencyPercent(trip.cost.contingencyPercent);
      setExpectedBudget(trip.cost.expectedBudget);
    }
    setAiPlan(trip.ai ?? null);
    setAiPrevOrder(null);
    setPlannerStep(4);
  };

  const buildTripText = (): string => {
    const lines: string[] = [
      tripTitle,
      `Xuất phát: ${originName} • ${plannerDays} ngày • ${adultCount + childCount} người • ${vehicleLabel} x${vehicleCount}`,
      `Đường bộ ~${schedule.roadKm} km${schedule.ferryKm > 0 ? ` • Đường thủy ${schedule.ferryKm} km` : ""}`,
      "",
    ];
    schedule.days.forEach((d) => {
      lines.push(`NGÀY ${d.day}${d.dateLabel ? ` (${d.dateLabel})` : ""}`);
      lines.push(`  ${fmtClock(d.startMin)} Khởi hành: ${d.startFrom}`);
      d.items.forEach((it) =>
        lines.push(`  ${fmtClock(it.start)}–${fmtClock(it.end)} ${it.place.name} (${it.place.region})`)
      );
      if (d.overnightName) lines.push(`  Nghỉ đêm: ${d.overnightPlace?.name || d.overnightName}`);
      if (d.returnLegs.length) lines.push(`  Quay về ${originName}`);
      lines.push("");
    });
    lines.push(`Tổng dự toán: ${formatDong(tripCost.grand)} (${formatDong(tripCost.perPerson)}/người)`);
    return lines.join("\n");
  };

  const handleCopyTripText = async () => {
    try {
      await navigator.clipboard.writeText(buildTripText());
      setTripCopied(true);
      setTimeout(() => setTripCopied(false), 2500);
    } catch {
      alert("Không sao chép được. Hãy dùng nút In / lưu PDF.");
    }
  };

  const handleCopyShareLink = async () => {
    try {
      const payload = { ...buildTripPayload(), ai: undefined }; // link chia sẻ không kèm bản AI cho gọn
      const json = JSON.stringify(payload);
      const code = btoa(unescape(encodeURIComponent(json)));
      const url = `${window.location.origin}${window.location.pathname}#trip=${code}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      alert("Không sao chép được liên kết.");
    }
  };

  const googleMapsRouteUrl = (): string => {
    const pts = selectedPlannerPlaces
      .filter((p) => p.tab !== "NHA_NGHI")
      .map((p) => `${p.latitude},${p.longitude}`);
    const o = `${originPt.lat},${originPt.lng}`;
    if (pts.length === 0) return `https://www.google.com/maps/search/?api=1&query=${o}`;
    const dest = roundTrip ? o : pts[pts.length - 1];
    const waypoints = (roundTrip ? pts : pts.slice(0, -1)).slice(0, 9);
    return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${dest}${
      waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}` : ""
    }&travelmode=driving`;
  };

  // Nhờ Gemini soạn lịch trình: sắp xếp thứ tự điểm, chia ngày, viết ghi chú và lời khuyên
  const handleAiPlan = async () => {
    if (selectedPlannerPlaces.length === 0) {
      setAiError("Hãy thêm ít nhất 1 địa điểm ở bước Điểm đến trước khi nhờ AI soạn lịch trình.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const toIn = (p: PlaceItem) => ({
        id: p.id,
        name: p.name,
        region: p.region,
        tab: p.tab,
        address: p.address,
        hours: p.openingHours,
        ticket: p.ticketPrice || 0,
        desc: p.shortDesc,
        island: Boolean(islandOfRegion(p.region)),
      });
      // Gợi ý thêm quán ăn / nhà nghỉ gần các điểm đã chọn
      const taken = new Set(plannerDestIds);
      const extra: PlaceItem[] = [];
      const pickNear = (anchor: PlaceItem, tab: FunctionalTab, n: number) => {
        places
          .filter((p) => p.isVisible && p.tab === tab && !taken.has(p.id))
          .map((p) => ({
            p,
            km: haversineKm(anchor.latitude, anchor.longitude, p.latitude, p.longitude),
          }))
          .sort((a, b) => a.km - b.km)
          .slice(0, n)
          .forEach(({ p }) => {
            taken.add(p.id);
            extra.push(p);
          });
      };
      selectedPlannerPlaces.slice(0, 10).forEach((p) => {
        pickNear(p, "AM_THUC", 2);
        pickNear(p, "NHA_NGHI", 1);
      });

      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip: {
            title: tripTitle,
            origin: originName,
            roundTrip,
            days: plannerDays,
            startDate,
            dayStart: dayStartTime,
            dayEnd: dayEndTime,
            pace: pace === "slow" ? "thư thả" : pace === "busy" ? "nhiều trải nghiệm" : "vừa phải",
            adults: adultCount,
            children: childCount,
            vehicle: vehicleLabel,
            vehicleCount,
            budget: expectedBudget,
          },
          stops: selectedPlannerPlaces.map(toIn),
          candidates: extra.slice(0, 30).map(toIn),
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok || !data.plan) {
        const code = String(data.error || `HTTP_${res.status}`);
        if (code === "MISSING_KEY") setAiError("Chưa cấu hình GEMINI_API_KEY trong file .env.local.");
        else if (res.status === 429)
          setAiError("Gemini báo vượt giới hạn lượt gọi. Hãy đợi một lúc rồi thử lại.");
        else if (/^GEMINI_(400|401|403|404)$/.test(code))
          setAiError(
            `Gemini trả lỗi ${code.replace("GEMINI_", "")}: kiểm tra lại GEMINI_API_KEY hoặc tên model (GEMINI_MODEL).`
          );
        else if (res.status === 404)
          setAiError("Không tìm thấy /api/itinerary. Kiểm tra route.ts đã đặt đúng thư mục chưa.");
        else setAiError(String(data.message || "AI chưa soạn được lịch trình, hãy thử lại."));
        return;
      }

      const validIds = new Set(plannerDestIds);
      const plan = sanitizeAiPlan(data.plan, validIds);
      if (!plan) {
        setAiError("AI trả về lịch trình không hợp lệ, hãy thử lại.");
        return;
      }
      // Áp dụng thứ tự AI sắp xếp; điểm AI bỏ sót được giữ lại ở cuối
      const order: string[] = [];
      plan.days.forEach((d) => d.stops.forEach((s) => order.push(s.placeId)));
      plannerDestIds.forEach((id) => {
        if (!order.includes(id)) order.push(id);
      });
      setAiPrevOrder(plannerDestIds);
      setPlannerDestIds(order);
      setAiPlan(plan);
    } catch {
      setAiError("Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setAiLoading(false);
    }
  };

  // Mở link chia sẻ (#trip=...) khi vừa vào web
  useEffect(() => {
    if (!isStorageLoaded) return;
    try {
      const h = window.location.hash;
      if (!h.startsWith("#trip=")) return;
      const json = decodeURIComponent(escape(atob(h.slice(6))));
      const trip = JSON.parse(json) as SavedTripItem;
      if (!trip || !Array.isArray(trip.destIds)) return;
      applyTrip(trip);
      setActiveTab("HANH_TRINH");
    } catch {
      /* link hỏng: bỏ qua */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStorageLoaded]);

  const handleLoadBenchmarkTest = () => {
    setCustomRoadKm(120);
    setVehicleType("personal_car");
    setVehicleCount(1);
    setFuelConsumption(6);
    setFuelPrice(25000);
    setTollFees(40000);
    setParkingFees(20000);
    setFoodPerPersonDay(0);
    setRoomPricePerNight(0);
    setContingencyPercent(0);
    setAdultCount(4);
    setChildCount(0);
    setExpectedBudget(300000);
  };

  const movePlannerStop = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= plannerDestIds.length) return;
    const copy = [...plannerDestIds];
    const temp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = temp;
    setPlannerDestIds(copy);
  };

  // Mở lại chuyến đi đã lưu: nạp lại toàn bộ lựa chọn và mở thẳng trang kết quả
  const handleLoadSavedTrip = (trip: SavedTripItem) => applyTrip(trip);

  // Xóa chuyến đi đã lưu
  const handleDeleteSavedTrip = (id: string) => {
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
  };

  // --- ADMIN: QUẢN LÝ KHU VỰC ---
  const handleSaveRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName.trim()) return;
    const display = newRegionDisplay.trim() || newRegionName.trim();

    if (editingRegionId) {
      const oldRegion = regions.find((r) => r.id === editingRegionId);
      setRegions((prev) =>
        prev.map((r) =>
          r.id === editingRegionId
            ? { ...r, name: newRegionName.trim(), displayLabel: display }
            : r
        )
      );
      if (oldRegion && oldRegion.name !== newRegionName.trim()) {
        setPlaces((prev) =>
          prev.map((p) =>
            p.region === oldRegion.name ? { ...p, region: newRegionName.trim() } : p
          )
        );
      }
      setEditingRegionId(null);
    } else {
      setRegions((prev) => [
        ...prev,
        {
          id: `reg-${Date.now()}`,
          name: newRegionName.trim(),
          displayLabel: display,
        },
      ]);
    }
    setNewRegionName("");
    setNewRegionDisplay("");
  };

  const handleDeleteRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    if (editingRegionId === id) {
      setEditingRegionId(null);
      setNewRegionName("");
      setNewRegionDisplay("");
    }
  };

  // --- ADMIN: QUẢN LÝ ĐỊA ĐIỂM ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<string>("");
  const [adminForm, setAdminForm] = useState({
    name: "",
    region: "Rạch Giá",
    tab: "THAM_QUAN" as FunctionalTab,
    subCategory: "Di tích lịch sử",
    badgeIcon: "🏛️",
    address: "",
    latitude: 10.0125,
    longitude: 105.0809,
    ticketPrice: 45000,
    priceLevel: "35.000 - 55.000 VND/tô",
    openingHours: "07:00 - 17:30",
    phone: "",
    shortDesc: "",
    imageUrl: "",
    tags: ["di_tich_lich_su", "van_hoa"] as string[],
  });

  // Nén ảnh (tối đa 900px, JPEG) rồi tải lên server, trả về đường dẫn ngắn (VD: /api/upload/abc.jpg).
  // Dữ liệu chỉ lưu đường dẫn nên file shared-travel-data.json và mỗi lần lưu rất nhẹ.
  const uploadImageFile = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        const maxWidth = 900;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Không xử lý được ảnh"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error("Không nén được ảnh"));
            try {
              const fd = new FormData();
              fd.append("file", blob, "image.jpg");
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const data = await res.json().catch(() => null);
              if (!res.ok || !data?.url) throw new Error(data?.error || "Tải ảnh lên thất bại");
              resolve(data.url as string);
            } catch (err) {
              reject(err);
            }
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("File không phải ảnh hợp lệ"));
      };
      img.src = objectUrl;
    });

  const handleImageUploadFromComputer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setAdminForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      alert("Không tải được ảnh lên: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // =====================================================================
  // ADMIN: QUẢN LÝ SẢN PHẨM OCOP (lưu chung vào danh sách places với tab = "OCOP")
  // Các trường riêng của OCOP được ghép vào culturalHistory dạng 2 dòng:
  //   Chủ thể sản phẩm: ... / Hạng sao OCOP: N sao
  // =====================================================================
  const OCOP_GROUP_SUGGESTIONS = [
    "Lương thực & Thực phẩm",
    "Nước mắm & Mắm đặc sản",
    "Gia vị & Đặc sản chế biến",
    "Đồ uống & Thảo mộc",
    "Thủ công mỹ nghệ",
    "Dịch vụ du lịch",
  ];
  const emptyOcopForm = () => ({
    name: "",
    owner: "",
    region: "",
    address: "",
    group: "",
    stars: 5,
    desc: "",
    imageUrl: "",
  });
  const [ocopEditingId, setOcopEditingId] = useState<string | null>(null);
  const [ocopForm, setOcopForm] = useState(emptyOcopForm);
  const [ocopSearch, setOcopSearch] = useState<string>("");
  const [ocopUploading, setOcopUploading] = useState<boolean>(false);

  const composeOcopInfo = (owner: string, stars: number) =>
    [
      `Chủ thể sản phẩm: ${owner.trim() || "Đang cập nhật"}`,
      `Hạng sao OCOP: ${Math.min(5, Math.max(3, Math.round(Number(stars) || 5)))} sao`,
    ].join("\n");

  const parseOcopInfo = (text: string) => {
    const pick = (label: string) => {
      const m = (text || "").match(new RegExp(`${label}:\\s*(.*)`));
      return m ? m[1].trim() : "";
    };
    const v = parseInt(pick("Hạng sao OCOP"), 10);
    return {
      owner: pick("Chủ thể sản phẩm"),
      stars: v >= 3 && v <= 5 ? v : 5,
    };
  };

  const ocopProducts = useMemo(
    () => places.filter((p) => p.tab === "OCOP"),
    [places]
  );

  // Điểm sao hiển thị trên web của sản phẩm OCOP luôn = hạng sao OCOP (4 sao -> 4/5, 5 sao -> 5/5).
  // Tự đồng bộ cho cả sản phẩm cũ đã lưu với điểm 5/5.
  useEffect(() => {
    if (!isStorageLoaded) return;
    const stale = places.some(
      (p) => p.tab === "OCOP" && p.rating !== parseOcopInfo(p.culturalHistory).stars
    );
    if (!stale) return;
    setPlaces((prev) =>
      prev.map((p) => {
        if (p.tab !== "OCOP") return p;
        const stars = parseOcopInfo(p.culturalHistory).stars;
        return p.rating === stars ? p : { ...p, rating: stars };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, isStorageLoaded]);

  const ocopVisibleList = useMemo(() => {
    const q = ocopSearch.trim();
    return ocopProducts.filter(
      (p) =>
        !q ||
        matchesVietnameseSearch(p.name, q) ||
        matchesVietnameseSearch(p.subCategory, q) ||
        matchesVietnameseSearch(p.culturalHistory, q) ||
        matchesVietnameseSearch(p.region, q)
    );
  }, [ocopProducts, ocopSearch]);

  const resetOcopForm = () => {
    setOcopEditingId(null);
    setOcopForm({ ...emptyOcopForm(), region: regions[0]?.name || "" });
  };

  const handleOcopImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcopUploading(true);
    try {
      const url = await uploadImageFile(file);
      setOcopForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      alert("Không tải được ảnh lên: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setOcopUploading(false);
    }
  };

  const handleOcopSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = ocopForm.name.trim();
    if (!name) return;
    const region = ocopForm.region || regions[0]?.name || "Rạch Giá";
    const address = ocopForm.address.trim() || region;

    const duplicate = places.find(
      (p) => p.id !== ocopEditingId && makePlaceKey(p.name, p.region) === makePlaceKey(name, region)
    );
    if (duplicate) {
      alert(`Sản phẩm "${duplicate.name}" tại ${duplicate.region} đã có trong hệ thống nên không thêm lại.`);
      return;
    }

    const info = composeOcopInfo(ocopForm.owner, ocopForm.stars);
    const finalImage = ocopForm.imageUrl.trim() || DEFAULT_PLACE_IMAGE_URL;
    const group = ocopForm.group.trim() || "OCOP 5 sao";

    if (ocopEditingId) {
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === ocopEditingId
            ? {
                ...p,
                name,
                region,
                address,
                subCategory: group,
                shortDesc: ocopForm.desc.trim(),
                culturalHistory: info,
                awardBadge: `OCOP ${ocopForm.stars} sao`,
                imageUrl: finalImage,
              }
            : p
        )
      );
    } else {
      // Lấy tọa độ của 1 địa điểm cùng khu vực để sản phẩm hiện đúng vị trí trên bản đồ / tính khoảng cách
      const sameRegion = places.find((p) => p.region === region && p.tab !== "OCOP");
      const created: PlaceItem = {
        id: `ocop-${Date.now()}`,
        name,
        region,
        tab: "OCOP",
        subCategory: group,
        badgeIcon: "🏅",
        address,
        latitude: sameRegion?.latitude ?? 10.0125,
        longitude: sameRegion?.longitude ?? 105.0809,
        rating: 5,
        reviewCount: 0,
        ticketPrice: 0,
        priceLevel: "Liên hệ chủ thể",
        openingHours: "Liên hệ chủ thể",
        phone: "Đang cập nhật",
        shortDesc: ocopForm.desc.trim(),
        culturalHistory: info,
        awardBadge: `OCOP ${ocopForm.stars} sao`,
        imageUrl: finalImage,
        tags: ["ocop", "dac_san", `${ocopForm.stars}_sao`],
        isVisible: true,
      };
      setPlaces((prev) => [created, ...prev]);
    }
    resetOcopForm();
  };

  // Đổi nhanh hạng sao OCOP của 1 sản phẩm (VD: được đánh giá lại từ 4 sao lên 5 sao)
  const handleOcopSetStars = (id: string, stars: number) => {
    setPlaces((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const info = parseOcopInfo(p.culturalHistory);
        return {
          ...p,
          culturalHistory: composeOcopInfo(info.owner, stars),
          awardBadge: `OCOP ${stars} sao`,
          tags: [...(p.tags || []).filter((t) => !/^\d_sao$/.test(t)), `${stars}_sao`],
        };
      })
    );
  };

  const handleOcopEdit = (p: PlaceItem) => {
    const info = parseOcopInfo(p.culturalHistory);
    setOcopEditingId(p.id);
    setOcopForm({
      name: p.name,
      owner: info.owner,
      region: p.region,
      address: p.address,
      group: p.subCategory,
      stars: info.stars,
      desc: p.shortDesc,
      imageUrl: isMissingImage(p) ? "" : p.imageUrl,
    });
    document.getElementById("ocop-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Nhập sản phẩm OCOP từ BẤT KỲ file Excel / CSV nào: tự dò dòng tiêu đề và các cột theo tên gần đúng.
  // Cột nhận diện: Tên sản phẩm (bắt buộc) | Chủ thể | Nơi cung cấp / Địa chỉ / Khu vực | Đôi nét / Mô tả |
  // Nhóm sản phẩm | Hạng sao | Hình ảnh (link). Thiếu cột nào thì dùng giá trị mặc định đang chọn trong form.
  const handleOcopImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const simplify = (v: any) => removeVietnameseTones(String(v ?? "")).replace(/[^a-z0-9]/g, "");
        const KEYS = {
          name: ["tensanpham", "tensp", "sanpham", "tenhang", "ten"],
          owner: ["chuthe", "chusohuu", "donvi", "congty", "nhasanxuat", "coso", "thuonghieu"],
          address: ["noicungcap", "noisanxuat", "diachi", "xaphuong", "diadiem", "khuvuc", "diaban"],
          desc: ["doinet", "mota", "gioithieu", "thongtin", "ghichu"],
          group: ["nhomsanpham", "nhom", "phanloai", "loai", "danhmuc"],
          stars: ["hangsao", "xephang", "phanhang", "sao", "hang"],
          image: ["hinhanh", "linkanh", "anh", "image", "imageurl", "hinh"],
        } as const;
        type ColKey = keyof typeof KEYS;
        const findCol = (headers: string[], key: ColKey, used: Set<number>) => {
          for (const k of KEYS[key]) {
            const i = headers.findIndex((h, idx) => !used.has(idx) && h === k);
            if (i >= 0) return i;
          }
          for (const k of KEYS[key]) {
            const i = headers.findIndex((h, idx) => !used.has(idx) && h.length > 0 && h.startsWith(k));
            if (i >= 0) return i;
          }
          for (const k of KEYS[key]) {
            if (k.length < 4) continue;
            const i = headers.findIndex((h, idx) => !used.has(idx) && h.includes(k));
            if (i >= 0) return i;
          }
          return -1;
        };

        // Chọn trang tính (sheet) có dòng tiêu đề chứa cột tên sản phẩm
        let rows: any[][] = [];
        let cols: Record<ColKey, number> | null = null;
        let headerIdx = -1;
        for (const sn of wb.SheetNames) {
          const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
          for (let r = 0; r < Math.min(aoa.length, 25); r++) {
            const headers = aoa[r].map((c) => simplify(c));
            if (headers.filter(Boolean).length < 2) continue;
            const used = new Set<number>();
            const nameIdx = findCol(headers, "name", used);
            if (nameIdx < 0) continue;
            used.add(nameIdx);
            const found = { name: nameIdx } as Record<ColKey, number>;
            (["owner", "address", "desc", "group", "stars", "image"] as ColKey[]).forEach((k) => {
              const i = findCol(headers, k, used);
              found[k] = i;
              if (i >= 0) used.add(i);
            });
            rows = aoa;
            cols = found;
            headerIdx = r;
            break;
          }
          if (cols) break;
        }
        // Không có dòng tiêu đề rõ ràng: lấy trang đầu, cột đầu tiên có chữ làm tên sản phẩm
        if (!cols) {
          const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
          const first = aoa.find((r) => r.some((c) => String(c).trim() !== "")) || [];
          const nameIdx = first.findIndex((c) => isNaN(Number(c)) && String(c).trim() !== "");
          if (nameIdx < 0) {
            alert("Không đọc được file: không tìm thấy cột nào chứa tên sản phẩm.");
            return;
          }
          rows = aoa;
          headerIdx = -1;
          cols = { name: nameIdx, owner: -1, address: -1, desc: -1, group: -1, stars: -1, image: -1 };
        }

        const cell = (r: any[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
        const seen = new Set(places.map((p) => makePlaceKey(p.name, p.region)));
        const sortedRegions = [...regions].sort((a, b) => b.name.length - a.name.length);
        const fresh: PlaceItem[] = [];
        let skippedDup = 0;
        let skippedEmpty = 0;
        const defaultRegion = ocopForm.region || regions[0]?.name || "Rạch Giá";

        rows.slice(headerIdx + 1).forEach((r, i) => {
          const name = cell(r, cols!.name);
          const simple = simplify(name);
          if (!name || simple.startsWith("tongcong") || simple === "stt" || /^\d+$/.test(name)) {
            skippedEmpty++;
            return;
          }
          const address = cell(r, cols!.address);
          const addrSimple = simplify(address + " " + name);
          const matched = sortedRegions.find((rg) => {
            const k = simplify(rg.name);
            return k.length >= 3 && addrSimple.includes(k);
          });
          const region = matched?.name || defaultRegion;
          const key = makePlaceKey(name, region);
          if (seen.has(key)) {
            skippedDup++;
            return;
          }
          seen.add(key);

          const starCell = cell(r, cols!.stars);
          const starMatch = starCell.match(/[3-5]/);
          const stars = starMatch ? Number(starMatch[0]) : ocopForm.stars;
          const imgCell = cell(r, cols!.image);
          const sameRegion = places.find((p) => p.region === region && p.tab !== "OCOP");

          fresh.push({
            id: `ocop-${Date.now()}-${i}`,
            name,
            region,
            tab: "OCOP",
            subCategory: cell(r, cols!.group) || "OCOP",
            badgeIcon: "🏅",
            address: address || region,
            latitude: sameRegion?.latitude ?? 10.0125,
            longitude: sameRegion?.longitude ?? 105.0809,
            rating: 5,
            reviewCount: 0,
            ticketPrice: 0,
            priceLevel: "Liên hệ chủ thể",
            openingHours: "Liên hệ chủ thể",
            phone: "Đang cập nhật",
            shortDesc: cell(r, cols!.desc),
            culturalHistory: composeOcopInfo(cell(r, cols!.owner), stars),
            awardBadge: `OCOP ${stars} sao`,
            imageUrl: /^https?:\/\//i.test(imgCell) ? imgCell : DEFAULT_PLACE_IMAGE_URL,
            tags: ["ocop", "dac_san", `${stars}_sao`],
            isVisible: true,
          });
        });

        if (fresh.length === 0) {
          alert(`Không có sản phẩm mới để thêm (trùng: ${skippedDup}, dòng trống/không hợp lệ: ${skippedEmpty}).`);
          return;
        }
        setPlaces((prev) => [...fresh, ...prev]);
        const noStarCol = cols.stars < 0 ? ` File không có cột hạng sao nên đặt ${ocopForm.stars} sao.` : "";
        alert(
          `Đã nhập ${fresh.length} sản phẩm OCOP (bỏ qua ${skippedDup} trùng).${noStarCol} Hãy kiểm tra khu vực và bấm "Thêm ảnh" cho từng sản phẩm.`
        );
      } catch (err) {
        alert("Không đọc được file Excel: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Nạp 20 sản phẩm OCOP 5 sao & 4 sao (từ file Excel). Sản phẩm đã nạp trước đó được cập nhật chữ,
  // nhưng GIỮ NGUYÊN ảnh và khu vực đã chọn.
  const handleSeedOcopSamples = () => {
    const findRegion = (kw: string) =>
      regions.find((r) => removeVietnameseTones(r.name).includes(kw))?.name ||
      regions[0]?.name ||
      "Rạch Giá";
    const samples = [
      {
        "name": "Gạo thơm đặc sản Thiên Vương",
        "owner": "Công ty TNHH MTV Lương thực Thoại Sơn",
        "kw": "thoai son",
        "address": "Xã Thoại Sơn (TT. Núi Sập cũ)",
        "lat": 10.2667,
        "lng": 105.2667,
        "group": "Lương thực & Thực phẩm",
        "stars": 5,
        "desc": "Gạo thơm đặc sản vùng Tứ giác Long Xuyên, hạt dài thon đẹp, trắng trong, ít bạc bụng. Cơm dẻo vừa, thơm dịu tự nhiên và giữ độ mềm ngọt ngay cả khi để nguội."
      },
      {
        "name": "Gạo ngon Tiến Vua Tiên Nữ",
        "owner": "Công ty TNHH MTV Lương thực Thoại Sơn",
        "kw": "thoai son",
        "address": "Xã Thoại Sơn (TT. Núi Sập cũ)",
        "lat": 10.2667,
        "lng": 105.2667,
        "group": "Lương thực & Thực phẩm",
        "stars": 5,
        "desc": "Dòng gạo đặc sản cao cấp canh tác bền vững, kiểm soát chặt chẽ từ vùng nguyên liệu đến đóng gói. Hạt gạo đều, cơm trắng bóng, vị ngọt đậm và hương thơm đặc trưng."
      },
      {
        "name": "Mật thốt nốt Palmania (dạng sệt, hạt, bột)",
        "owner": "Công ty Cổ phần Palmania",
        "kw": "tri ton",
        "address": "Xã Tri Tôn (TT. Tri Tôn cũ)",
        "lat": 10.4108,
        "lng": 105.0003,
        "group": "Gia vị & Đặc sản chế biến",
        "stars": 5,
        "desc": "Sản xuất 100% từ mật hoa thốt nốt tươi thu hoạch thủ công tại vùng Bảy Núi, không chất bảo quản, chỉ số đường huyết thấp. Gồm 3 dòng (sệt, hạt, bột) vị ngọt thanh, hương caramen dịu nhẹ."
      },
      {
        "name": "Nước mắm Phú Quốc Khải Hoàn (38, 40, 43 độ đạm)",
        "owner": "Công ty Cổ phần Thương mại Khải Hoàn",
        "kw": "phu quoc",
        "address": "Đặc khu Phú Quốc (Dương Đông cũ)",
        "lat": 10.2167,
        "lng": 103.9667,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 5,
        "desc": "Nước mắm truyền thống mang chỉ dẫn địa lý Phú Quốc, ủ chượp 12–15 tháng trong thùng gỗ bời lời từ cá cơm tươi. Gồm 3 mức độ đạm tự nhiên, màu cánh gián trong, hậu vị ngọt sâu."
      },
      {
        "name": "Nước mắm Thanh Quốc (35, 40, 43 độ đạm)",
        "owner": "Công ty TNHH SX & KD Nước mắm Thanh Quốc",
        "kw": "phu quoc",
        "address": "Đặc khu Phú Quốc (Dương Đông cũ)",
        "lat": 10.2167,
        "lng": 103.9667,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 5,
        "desc": "Nước mắm cốt cá cơm sọc tiêu nguyên chất ủ chượp gia truyền, đạt chuẩn chỉ dẫn địa lý Phú Quốc bảo hộ tại EU. Giàu axit amin tự nhiên, màu đỏ nâu bắt mắt, phù hợp ăn hằng ngày và xuất khẩu."
      },
      {
        "name": "Nước mắm Phú Quốc Huỳnh Khoa (40, 43, 45 độ đạm)",
        "owner": "Công ty TNHH KD Nước mắm Huỳnh Khoa",
        "kw": "phu quoc",
        "address": "Đặc khu Phú Quốc (Dương Đông & Cửa Dương cũ)",
        "lat": 10.2167,
        "lng": 103.9667,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 5,
        "desc": "Nước mắm cốt nhĩ truyền thống ủ chượp hơn 12 tháng bằng phương pháp gài nén lâu đời, không phụ gia. Nổi bật với dòng 45 độ đạm tự nhiên cao nhất tỉnh, sóng sánh màu cánh gián."
      },
      {
        "name": "Rau quả & Đặc sản đóng hộp Antesco (Bắp non, thốt nốt, cá linh)",
        "owner": "Công ty Cổ phần Rau quả Thực phẩm An Giang (Antesco)",
        "kw": "long xuyen",
        "address": "Phường Long Xuyên",
        "lat": 10.3759,
        "lng": 105.4185,
        "group": "Lương thực & Thực phẩm",
        "stars": 4,
        "desc": "Bộ sản phẩm chế biến đóng hộp xuất khẩu gồm bắp non đóng hộp (tiềm năng 5 sao), thốt nốt đóng lon, mắm cá linh chưng và cá linh kho mía. Quy trình hiện đại, giữ trọn hương vị đặc sản miền Tây."
      },
      {
        "name": "Đường thốt nốt Trần Gia (dạng chảy, bột, viên)",
        "owner": "Công ty CP Phát triển Đặc sản Vùng miền Trần Gia",
        "kw": "tinh bien",
        "address": "Phường Tịnh Biên (TT. Tịnh Biên cũ)",
        "lat": 10.5833,
        "lng": 105.0,
        "group": "Gia vị & Đặc sản chế biến",
        "stars": 4,
        "desc": "Đường thốt nốt nguyên chất nấu thủ công từ nước hoa thốt nốt vùng Bảy Núi, không pha đường tinh luyện hay chất tẩy trắng. Vị ngọt thanh, béo nhẹ, mùi thơm nồng đặc trưng dùng nấu chè và kho cá."
      },
      {
        "name": "Mắm Bà Giáo Khỏe 7 số 7 (Mắm thái, cá linh, cá sặc)",
        "owner": "Doanh nghiệp tư nhân Mắm Bà Giáo Khỏe",
        "kw": "chau doc",
        "address": "Phường Châu Đốc",
        "lat": 10.7,
        "lng": 105.1167,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 4,
        "desc": "Thương hiệu mắm truyền thống trứ danh vùng Châu Đốc với bí quyết ủ chượp nhiều đời từ cá đồng tự nhiên. Thịt mắm thơm đậm, vị mặn ngọt hài hòa, là món quà đặc sản hàng đầu của du khách."
      },
      {
        "name": "Mắm cá mè vinh Bà Sáu",
        "owner": "Hộ kinh doanh sản xuất mắm Bà Sáu",
        "kw": "tan chau",
        "address": "Phường Long Phú (TX. Tân Châu cũ)",
        "lat": 10.8,
        "lng": 105.2333,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 4,
        "desc": "Đặc sản mắm cá đồng vùng đầu nguồn sông Tiền, chế biến tỉ mỉ từ cá mè vinh tươi kết hợp thính gạo rang và đường thốt nốt. Khi chưng hoặc nấu lẩu có vị béo ngậy và mùi thơm đặc trưng."
      },
      {
        "name": "Trà Kim Ngân Hoa Thái Minh Nguyên",
        "owner": "Công ty TNHH MTV TM&DV Thái Minh Nguyên",
        "kw": "cho moi",
        "address": "Xã Chợ Mới (TT. Chợ Mới cũ)",
        "lat": 10.45,
        "lng": 105.4333,
        "group": "Đồ uống & Thảo mộc",
        "stars": 4,
        "desc": "Trà thảo mộc sản xuất từ hoa kim ngân trồng sạch theo tiêu chí không chất bảo quản, không phẩm màu. Vị ngọt dịu tự nhiên, hương thơm thanh mát, hỗ trợ thanh nhiệt và dễ ngủ."
      },
      {
        "name": "Bánh hạnh nhân Tiến Anh",
        "owner": "Công ty TNHH MTV Tiến Anh",
        "kw": "phu tan",
        "address": "Xã Phú Tân (TT. Phú Mỹ cũ)",
        "lat": 10.66,
        "lng": 105.27,
        "group": "Lương thực & Thực phẩm",
        "stars": 4,
        "desc": "Đặc sản bánh truyền thống nổi tiếng xứ cù lao Phú Tân, làm từ bột đậu xanh, bột mì, đường và hạt hạnh nhân nướng vàng. Bánh giòn xốp, tan nhẹ trong miệng, thơm bùi và ngọt vừa phải."
      },
      {
        "name": "Khô cá tra phồng Chín Thảo",
        "owner": "Cơ sở sản xuất Khô cá tra phồng Chín Thảo",
        "kw": "chau phu",
        "address": "Xã Châu Phú (TT. Cái Dầu cũ)",
        "lat": 10.5667,
        "lng": 105.2333,
        "group": "Lương thực & Thực phẩm",
        "stars": 4,
        "desc": "Chế biến từ cá tra thịt trắng tươi ngon, tẩm ướp gia vị hài hòa và phơi nắng tự nhiên đúng độ. Khi chiên lớp da phồng giòn rụm, thịt bên trong béo mềm, thơm ngon đặc trưng vùng sông Hậu."
      },
      {
        "name": "Lụa Lãnh Mỹ A Tân Châu",
        "owner": "Cơ sở dệt lụa Tám Lăng",
        "kw": "tan chau",
        "address": "Phường Tân Châu (P. Long Thạnh cũ)",
        "lat": 10.8,
        "lng": 105.2333,
        "group": "Thủ công mỹ nghệ",
        "stars": 4,
        "desc": "Dòng lụa tơ tằm thượng hạng trứ danh miền Tây, dệt thủ công và nhuộm hoàn toàn từ nhựa trái mặc nưa qua hàng chục công đoạn. Mặt lụa đen huyền bóng mượt, mặc mát vào mùa hè và ấm vào mùa đông."
      },
      {
        "name": "Gạo hữu cơ Kim Thiên Lộc (Nàng Hương, Lức đỏ, Lức đen)",
        "owner": "Hợp tác xã Nông hữu cơ Rạch Giá",
        "kw": "rach gia",
        "address": "Phường Rạch Giá (P. Vĩnh Lạc cũ)",
        "lat": 10.0125,
        "lng": 105.0809,
        "group": "Lương thực & Thực phẩm",
        "stars": 4,
        "desc": "Dòng gạo canh tác theo quy trình hữu cơ an toàn gồm Nàng Hương, Lức đỏ và Lức đen giàu dinh dưỡng. Hạt gạo chắc mẩy, giàu chất xơ và chất chống oxy hóa, thích hợp cho chế độ ăn thực dưỡng."
      },
      {
        "name": "Thủ công mỹ nghệ Cỏ bàng Phú Mỹ (Túi xách, sọt, tụng)",
        "owner": "Hợp tác xã Phụ nữ Cỏ bàng Phú Mỹ",
        "kw": "giang thanh",
        "address": "Xã Giang Thành (Xã Phú Mỹ cũ)",
        "lat": 10.4167,
        "lng": 104.8333,
        "group": "Thủ công mỹ nghệ",
        "stars": 4,
        "desc": "Sản phẩm đan lát thủ công tinh xảo từ cây cỏ bàng tự nhiên vùng đồng cỏ bàng Phú Mỹ, thân thiện môi trường. Đa dạng mẫu mã túi xách thời trang, tụng và sọt trang trí, đạt chuẩn sản phẩm nông thôn tiêu biểu."
      },
      {
        "name": "Đồ thủ công Cỏ bàng Toàn Tuyền (Giỏ xách, thùng sọt)",
        "owner": "Cơ sở sản xuất thủ công mỹ nghệ Toàn Tuyền",
        "kw": "giang thanh",
        "address": "Xã Giang Thành (Xã Phú Lợi cũ)",
        "lat": 10.4167,
        "lng": 104.8333,
        "group": "Thủ công mỹ nghệ",
        "stars": 4,
        "desc": "Các dòng giỏ xách và thùng sọt đan tay từ nguyên liệu cỏ bàng phơi khô tự nhiên, xử lý chống ẩm mốc kỹ lưỡng. Thiết kế bền đẹp, mộc mạc, phục vụ thị trường quà tặng du lịch và xuất khẩu."
      },
      {
        "name": "Rượu Vang Sim Phú Quốc (Sim Sơn)",
        "owner": "Công ty TNHH TM&DV Sim Sơn Phú Quốc",
        "kw": "phu quoc",
        "address": "Đặc khu Phú Quốc (Xã Dương Tơ cũ)",
        "lat": 10.2167,
        "lng": 103.9667,
        "group": "Đồ uống & Thảo mộc",
        "stars": 4,
        "desc": "Lên men tự nhiên từ trái hồng sim rừng chín mọng thu hái tại đảo Phú Quốc theo quy trình kiểm soát chặt chẽ. Rượu có màu đỏ tím đẹp mắt, vị ngọt chát hài hòa, hương sim rừng thơm nồng đặc trưng."
      },
      {
        "name": "Nước mắm Phú Quốc Thịnh Phát (35, 40 độ đạm)",
        "owner": "Doanh nghiệp tư nhân Nước mắm Thịnh Phát",
        "kw": "phu quoc",
        "address": "Đặc khu Phú Quốc (Dương Đông cũ)",
        "lat": 10.2167,
        "lng": 103.9667,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 4,
        "desc": "Thương hiệu nhà thùng lâu đời tại Phú Quốc, ủ chượp hoàn toàn tự nhiên từ cá cơm tươi và muối biển trong thùng gỗ lớn. Nước mắm có màu cánh gián tự nhiên, mùi thơm dịu và hậu vị ngọt đậm."
      },
      {
        "name": "Nước mắm Phú Quốc Phụng Hưng (40, 45 độ đạm)",
        "owner": "Doanh nghiệp tư nhân Nước mắm Phụng Hưng",
        "kw": "phu quoc",
        "address": "Đặc khu Phú Quốc (An Thới cũ)",
        "lat": 10.2167,
        "lng": 103.9667,
        "group": "Nước mắm & Mắm đặc sản",
        "stars": 4,
        "desc": "Nước mắm cốt truyền thống đạt chỉ dẫn địa lý Phú Quốc sản xuất theo quy trình khép kín chuẩn xuất khẩu. Độ đạm tự nhiên cao, hương vị đậm đà tinh khiết, được nhiều du khách chọn mua làm quà."
      }
    ];
    const existingIds = new Set(places.map((p) => p.id));
    const existingKeys = new Set(places.map((p) => makePlaceKey(p.name, p.region)));
    const fresh: PlaceItem[] = [];
    const updates: Record<string, Partial<PlaceItem>> = {};
    samples.forEach((sm, i) => {
      const id = `ocop-seed-${i + 1}`;
      const text = {
        name: sm.name,
        subCategory: sm.group,
        address: sm.address,
        shortDesc: sm.desc,
        culturalHistory: composeOcopInfo(sm.owner, sm.stars),
        awardBadge: `OCOP ${sm.stars} sao`,
        tags: ["ocop", "dac_san", `${sm.stars}_sao`],
      };
      if (existingIds.has(id)) {
        updates[id] = text;
        return;
      }
      const region = findRegion(sm.kw);
      if (existingKeys.has(makePlaceKey(sm.name, region))) return;
      fresh.push({
        id,
        region,
        tab: "OCOP",
        badgeIcon: "🏅",
        latitude: sm.lat,
        longitude: sm.lng,
        rating: 5,
        reviewCount: 0,
        ticketPrice: 0,
        priceLevel: "Liên hệ chủ thể",
        openingHours: "Liên hệ chủ thể",
        phone: "Đang cập nhật",
        imageUrl: DEFAULT_PLACE_IMAGE_URL,
        isVisible: true,
        ...text,
      } as PlaceItem);
    });
    if (fresh.length === 0 && Object.keys(updates).length === 0) {
      alert("Các sản phẩm OCOP trong Excel đã có đủ trong hệ thống.");
      return;
    }
    setPlaces((prev) => [
      ...fresh,
      ...prev.map((p) => (updates[p.id] ? { ...p, ...updates[p.id] } : p)),
    ]);
    alert(
      `Đã thêm ${fresh.length} và cập nhật ${Object.keys(updates).length} sản phẩm OCOP. Hãy bấm "Thêm ảnh" cho từng sản phẩm.`
    );
  };

  // Thêm ảnh nhanh cho 1 địa điểm ngay trong bảng danh sách (không cần mở form sửa)
  const handleQuickImageUpload = async (placeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, imageUrl: url } : p)));
    } catch (err) {
      alert("Không tải được ảnh lên: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Dán link ảnh (VD: link ảnh Google Maps) cho 1 địa điểm ngay trong bảng danh sách
  const handleQuickImageLink = (placeId: string) => {
    const input = window.prompt("Dán link ảnh (https://...) cho địa điểm này:");
    if (input === null) return;
    const url = input.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      alert("Link không hợp lệ. Link ảnh phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    setPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, imageUrl: url } : p)));
  };

  // Chuyển các ảnh cũ đang lưu dạng base64 (rất nặng) thành file trên server, một lần
  const [migratingImages, setMigratingImages] = useState(false);
  const base64ImageCount = useMemo(
    () => places.filter((p) => (p.imageUrl || "").startsWith("data:")).length,
    [places]
  );
  const migrateBase64Images = async () => {
    if (migratingImages) return;
    setMigratingImages(true);
    let failed = 0;
    try {
      const targets = places.filter((p) => (p.imageUrl || "").startsWith("data:"));
      const results: Record<string, string> = {}; // không dùng Map vì tên "Map" đang là icon lucide-react
      for (const p of targets) {
        try {
          const blob = await (await fetch(p.imageUrl)).blob();
          results[p.id] = await uploadImageFile(blob);
        } catch {
          failed++;
        }
      }
      if (Object.keys(results).length > 0) {
        setPlaces((prev) =>
          prev.map((p) => (results[p.id] ? { ...p, imageUrl: results[p.id] } : p))
        );
      }
    } finally {
      setMigratingImages(false);
    }
    if (failed > 0) alert(`Có ${failed} ảnh chưa chuyển được, bạn bấm lại để thử tiếp.`);
  };

  // --- NHẬP EXCEL: HỎI LOẠI FILE TRƯỚC KHI NHẬP ---
  const [pendingExcelFile, setPendingExcelFile] = useState<File | null>(null);
  const [importTab, setImportTab] = useState<FunctionalTab | "HUB">("THAM_QUAN");
  const [autoFindImages, setAutoFindImages] = useState<boolean>(true);
  const [imageFetchProgress, setImageFetchProgress] = useState<{
    done: number;
    total: number;
    found: number;
    note?: string;
  } | null>(null);

  // Tự tìm ảnh cho từng địa điểm vừa nhập (qua /api/place-image dùng Gemini)
  const fetchImagesForPlaces = async (
    list: { id: string; name: string; region: string; address: string }[]
  ) => {
    setImageFetchProgress({ done: 0, total: list.length, found: 0 });
    let found = 0;
    const reasons: Record<string, number> = {};
    let lastMessage = "";
    const buildNote = () =>
      Object.entries(reasons)
        .map(([k, v]) => `${k} ×${v}`)
        .join(" • ") + (lastMessage ? ` — ${lastMessage}` : "");

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      let fatal = false;
      try {
        const res = await fetch(
          `/api/place-image?name=${encodeURIComponent(item.name)}&region=${encodeURIComponent(
            item.region
          )}&address=${encodeURIComponent(item.address)}`
        );
        const data = await res.json().catch(() => ({}));

        if (data.imageUrl) {
          found++;
          setPlaces((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, imageUrl: data.imageUrl } : p))
          );
        } else {
          const key = data.error || data.reason || `HTTP_${res.status}`;
          reasons[key] = (reasons[key] || 0) + 1;
          if (data.message) lastMessage = String(data.message).slice(0, 160);

          if (data.error === "MISSING_KEY") {
            alert("Chưa cấu hình GEMINI_API_KEY trong file .env.local nên chưa thể tự tìm ảnh.");
            fatal = true;
          } else if (res.status === 429) {
            alert("Gemini báo vượt giới hạn lượt gọi. Đã dừng tìm ảnh, các địa điểm còn lại dùng ảnh mặc định.");
            fatal = true;
          } else if (/^GEMINI_(400|401|403|404)$/.test(String(data.error))) {
            alert(
              `Gemini trả lỗi ${String(data.error).replace("GEMINI_", "")}: kiểm tra lại GEMINI_API_KEY hoặc tên model. Đã dừng tìm ảnh.`
            );
            fatal = true;
          } else if (res.status === 404) {
            alert("Không tìm thấy /api/place-image. Kiểm tra route.ts đã đặt đúng thư mục chưa.");
            fatal = true;
          }
        }
      } catch {
        reasons["NETWORK_ERROR"] = (reasons["NETWORK_ERROR"] || 0) + 1;
      }
      setImageFetchProgress({ done: i + 1, total: list.length, found, note: buildNote() });
      if (fatal) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    setTimeout(() => setImageFetchProgress(null), 30000);
  };

  const IMPORT_TAB_OPTIONS: {
    id: FunctionalTab;
    label: string;
    icon: string;
    subCategory: string;
    badgeIcon: string;
  }[] = [
    { id: "THAM_QUAN", label: tabLabels.THAM_QUAN || "Tham quan", icon: "🏛️", subCategory: "Điểm tham quan", badgeIcon: "📍" },
    { id: "AM_THUC", label: tabLabels.AM_THUC || "Ẩm thực", icon: "🍜", subCategory: "Ẩm thực", badgeIcon: "🍜" },
    { id: "NHA_NGHI", label: tabLabels.NHA_NGHI || "Nhà nghỉ", icon: "🏨", subCategory: "Lưu trú", badgeIcon: "🏨" },
    { id: "MUA_SAM", label: tabLabels.MUA_SAM || "Mua sắm", icon: "🛍️", subCategory: "Mua sắm", badgeIcon: "🛍️" },
    { id: "LE_HOI", label: tabLabels.LE_HOI || "Lễ hội", icon: "🎉", subCategory: "Lễ hội", badgeIcon: "🎉" },
    { id: "OCOP", label: tabLabels.OCOP || "Sản phẩm OCOP", icon: "🏅", subCategory: "OCOP 5 sao", badgeIcon: "🏅" },
  ];

  // Bước 1: chọn file -> mở hộp thoại hỏi loại
  const handleSelectExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingExcelFile(file);
    setImportTab("THAM_QUAN");
    e.target.value = "";
  };

  // Nhập Bến tàu / Bến xe / Sân bay từ Excel
  // Cột: Tên (bắt buộc) | Loại (Bến tàu / Bến xe / Sân bay) | Tọa Độ hoặc Vĩ độ + Kinh độ | Ghi chú | Địa chỉ
  const importHubsFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target?.result, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        const simplify = (v: any) => removeVietnameseTones(String(v)).replace(/[^a-z0-9]/g, "");
        const headerIdx = aoa
          .slice(0, 15)
          .findIndex(
            (r) =>
              r.some((c) => simplify(c).startsWith("ten")) &&
              r.some((c) => ["toado", "vido", "latitude", "lat"].some((k) => simplify(c).startsWith(k)))
          );
        if (headerIdx < 0) {
          alert('Không tìm thấy hàng tiêu đề. File cần có cột "Tên" và cột "Tọa Độ" (hoặc "Vĩ độ" + "Kinh độ").');
          return;
        }
        const headers = aoa[headerIdx].map((h) => simplify(h));
        const col = (...keys: string[]) =>
          headers.findIndex((h) => keys.some((k) => h === k || h.startsWith(k)));
        const iName = col("ten");
        const iType = col("loai");
        const iCoord = col("toado");
        const iLat = col("vido", "latitude", "lat");
        const iLng = col("kinhdo", "longitude", "lng", "long");
        const iNote = col("ghichu", "mota", "note");
        const iAddr = col("diachi");

        const existing = new Set(transitHubs.map((h) => `${removeVietnameseTones(h.name)}|${h.type}`));
        const fresh: TransitHub[] = [];
        const skipped: string[] = [];
        const invalid: string[] = [];

        aoa
          .slice(headerIdx + 1)
          .filter((r) => r.some((c) => String(c).trim() !== ""))
          .forEach((r, idx) => {
            const name = String(r[iName] ?? "").trim();
            if (!name) return;
            let lat = NaN;
            let lng = NaN;
            if (iLat >= 0 && iLng >= 0 && String(r[iLat]).trim() !== "") {
              lat = parseFloat(String(r[iLat]).replace(",", "."));
              lng = parseFloat(String(r[iLng]).replace(",", "."));
            } else if (iCoord >= 0) {
              const nums = String(r[iCoord]).match(/\d+(?:[.,]\d+)?/g);
              if (nums && nums.length >= 2) {
                lat = parseFloat(nums[0].replace(",", "."));
                lng = parseFloat(nums[1].replace(",", "."));
              }
            }
            // Nếu nhập ngược (kinh độ trước vĩ độ) thì tự đổi lại
            if (lat > 50 && lng < 50) [lat, lng] = [lng, lat];
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 5 || lat > 25 || lng < 100 || lng > 110) {
              invalid.push(name);
              return;
            }
            const type = detectHubType(iType >= 0 ? String(r[iType]) : "", name);
            const key = `${removeVietnameseTones(name)}|${type}`;
            if (existing.has(key)) {
              skipped.push(name);
              return;
            }
            existing.add(key);
            const note = [iNote >= 0 ? String(r[iNote]).trim() : "", iAddr >= 0 ? String(r[iAddr]).trim() : ""]
              .filter(Boolean)
              .join(" • ");
            fresh.push({ id: `hub-excel-${Date.now()}-${idx}`, name, type, lat, lng, note });
          });

        if (fresh.length > 0) setTransitHubs((prev) => [...prev, ...fresh]);
        alert(
          `Đã thêm ${fresh.length} điểm giao thông vào bản đồ.` +
            (skipped.length ? `\nBỏ qua ${skipped.length} điểm đã có: ${skipped.slice(0, 6).join(", ")}` : "") +
            (invalid.length ? `\nBỏ qua ${invalid.length} dòng thiếu/sai tọa độ: ${invalid.slice(0, 6).join(", ")}` : "")
        );
      } catch (err) {
        console.error("Lỗi đọc file Excel bến tàu/xe/sân bay:", err);
        alert("Có lỗi khi đọc file Excel. Hãy kiểm tra lại định dạng file!");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Tải file Excel mẫu cho bến tàu / bến xe / sân bay
  const handleDownloadHubTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["STT", "Tên", "Loại", "Địa chỉ", "Tọa Độ (Vĩ độ, Kinh độ)", "Ghi chú"],
      [1, "Bến tàu Rạch Giá", "Bến tàu", "Mạc Cửu, Rạch Giá", "10.0145, 105.0752", "Tàu cao tốc đi Phú Quốc"],
      [2, "Bến xe Long Xuyên", "Bến xe", "Long Xuyên", "10.3625, 105.4521", "Xe khách liên tỉnh"],
      [3, "Cảng hàng không Phú Quốc", "Sân bay", "Dương Tơ, Phú Quốc", "10.1698, 103.9931", "Sân bay quốc tế"],
    ]);
    ws["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 12 }, { wch: 30 }, { wch: 26 }, { wch: 36 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BenTauBenXeSanBay");
    XLSX.writeFile(wb, "mau-ben-tau-ben-xe-san-bay.xlsx");
  };

  // Bước 2: xác nhận loại -> mới đọc file và nhập
  const handleConfirmImportExcel = () => {
    if (!pendingExcelFile) return;
    const file = pendingExcelFile;
    if (importTab === "HUB") {
      setPendingExcelFile(null);
      importHubsFromFile(file);
      return;
    }
    const targetTab: FunctionalTab = importTab;
    const tabMeta = IMPORT_TAB_OPTIONS.find((o) => o.id === targetTab)!;
    setPendingExcelFile(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Đọc theo dạng mảng để tự tìm hàng tiêu đề thật (file có thể có dòng tiêu đề lớn ở trên, hoặc mất tiêu đề)
        const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        const simplify = (v: any) => removeVietnameseTones(String(v)).replace(/[^a-z0-9]/g, "");

        // Hàng tiêu đề = hàng (trong 15 hàng đầu) có cột "Địa chỉ" và cột bắt đầu bằng "Tên"
        const headerIdx = aoa
          .slice(0, 15)
          .findIndex(
            (r) =>
              r.some((c) => simplify(c) === "diachi") &&
              r.some((c) => simplify(c).startsWith("ten"))
          );

        let rows: any[] = [];
        if (headerIdx >= 0) {
          const headers = aoa[headerIdx].map((h) => String(h).trim());
          rows = aoa
            .slice(headerIdx + 1)
            .filter((r) => r.some((c) => String(c).trim() !== ""))
            .map((r) => {
              const obj: any = {};
              headers.forEach((h, j) => {
                if (h) obj[h] = r[j] ?? "";
              });
              return obj;
            });
        } else if (targetTab === "NHA_NGHI") {
          // File nhà nghỉ bị mất hàng tiêu đề: đọc theo vị trí cột cố định
          // A: STT | B: Tên | C: Địa chỉ | D: Khu vực | E: Đánh giá | F: Số đánh giá | G: Đánh giá nổi bật | H: Tọa độ | I: Giá tiền tham khảo
          const fallbackHeaders = [
            "STT",
            "Tên Khách Sạn / Chỗ Ở",
            "Địa chỉ",
            "Khu vực (xã/phường)",
            "Đánh giá",
            "Số đánh giá",
            "Đánh Giá Nổi Bật",
            "Tọa Độ",
            "Giá tiền tham khảo",
          ];
          rows = aoa
            .filter((r) => typeof r[0] === "number" && String(r[1]).trim() !== "")
            .map((r) => {
              const obj: any = {};
              fallbackHeaders.forEach((h, j) => {
                obj[h] = r[j] ?? "";
              });
              return obj;
            });
        } else {
          rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        }

        if (rows.length === 0) {
          alert("File Excel trống hoặc không đúng định dạng!");
          return;
        }

        const importedPlaces: PlaceItem[] = [];
        const importedReviews: UserReviewItem[] = [];
        const newRegionNames = new Set<string>();

        // Đọc cột linh hoạt: bỏ dấu, bỏ khoảng trắng/xuống dòng/ký tự lạ trong tiêu đề cột
        const normKey = (s: string) => removeVietnameseTones(String(s)).replace(/[^a-z0-9]/g, "");
        const getCell = (row: any, ...aliases: string[]): any => {
          const wanted = aliases.map(normKey);
          for (const k of Object.keys(row)) {
            if (wanted.includes(normKey(k))) {
              const v = row[k];
              if (v !== "" && v !== null && v !== undefined) return v;
            }
          }
          return "";
        };

        rows.forEach((row, index) => {
          const name = String(
            getCell(
              row,
              "Tên Địa Điểm",
              "Ten Dia Diem",
              "Tên Khách Sạn / Chỗ Ở",
              "Tên Khách Sạn",
              "Tên Chỗ Ở",
              "Tên Nhà Nghỉ"
            )
          ).trim();
          if (!name) return;

          const address = String(getCell(row, "Địa chỉ", "Dia chi") || "An Giang").trim();
          const region = canonicalRegionName(
            String(getCell(row, "Khu vực (xã/phường)", "Khu vực", "Khu vuc") || "An Giang")
          );

          // Điểm đánh giá: lấy số đầu tiên trong ô, VD "4,5" hoặc "4,5 (1.519)" -> 4.5
          const ratingCell = getCell(row, "Đánh giá", "Danh gia", "Rating");
          let ratingValue = 4.5;
          if (typeof ratingCell === "number") {
            ratingValue = ratingCell;
          } else {
            const ratingMatch = String(ratingCell).match(/\d+(?:[.,]\d+)?/);
            if (ratingMatch) ratingValue = parseFloat(ratingMatch[0].replace(",", "."));
          }
          const rating = normalizeRating(ratingValue);

          // Số đánh giá: ô số lấy nguyên, ô chữ chỉ giữ chữ số (VD "1.519" -> 1519)
          const reviewCountCell = getCell(row, "Số đánh giá", "So danh gia");
          const reviewCount =
            typeof reviewCountCell === "number"
              ? Math.round(reviewCountCell)
              : parseInt(String(reviewCountCell).replace(/[^\d]/g, ""), 10) || 10;

          // Xử lý Đánh Giá Nổi Bật (Bỏ dấu ngoặc kép thừa ở 2 đầu)
          const prominentReview = String(getCell(row, "Đánh Giá Nổi Bật", "Danh gia noi bat"))
            .replace(/^["“”']+|["“”']+$/g, "")
            .trim();

          // Xử lý Tọa Độ (VD: "10.5124° N, 104.9215° E")
          const rawCoords = String(
            getCell(row, "Tọa Độ (Kinh độ, Vĩ độ)", "Tọa Độ", "Toa Do")
          );
          const coordMatches = rawCoords.match(/\d+(\.\d+)?/g);
          const latitude =
            coordMatches && coordMatches.length >= 1 ? parseFloat(coordMatches[0]) : 10.4735;
          const longitude =
            coordMatches && coordMatches.length >= 2 ? parseFloat(coordMatches[1]) : 104.9912;

          // Mô tả về địa điểm tham quan
          // Chỉ mục Tham quan mới đọc cột mô tả
          const description =
            targetTab === "THAM_QUAN"
              ? String(getCell(row, "Mô tả về địa điểm tham quan", "Mô tả", "Mo ta")).trim()
              : "";

          // Mục Ẩm thực và Nhà nghỉ mới đọc cột giá. VD "100.000 - 500.000 VND" -> trung bình 300.000
          // (Nhà nghỉ chỉ lưu dạng chữ để hiển thị, không đưa vào chi phí hành trình)
          const hasPriceColumn = targetTab === "AM_THUC" || targetTab === "NHA_NGHI";
          let priceText = targetTab === "NHA_NGHI" ? "Đang cập nhật" : "Theo thực đơn";
          let avgPrice = 0;
          if (hasPriceColumn) {
            const priceCell = getCell(
              row,
              "Giá Tiền của quán",
              "Giá tiền tham khảo",
              "Giá tham khảo",
              "Giá phòng",
              "Giá tiền",
              "Giá trung bình",
              "Gia tien cua quan"
            );
            if (typeof priceCell === "number") {
              avgPrice = Math.round(priceCell);
              priceText = `${avgPrice.toLocaleString("vi-VN")} VND`;
            } else if (String(priceCell).trim()) {
              priceText = normalizePriceText(String(priceCell).trim());
              const nums = (priceText.match(/\d[\d.,]*/g) || [])
                .map((s) => parseInt(s.replace(/[^\d]/g, ""), 10))
                .filter((n) => n > 0);
              if (nums.length >= 2) avgPrice = Math.round((nums[0] + nums[1]) / 2);
              else if (nums.length === 1) avgPrice = nums[0];
            }
          }

          // Tự động nhận diện Nhãn & Icon theo tên địa điểm
          let subCategory = "Điểm tham quan";
          let badgeIcon = "📍";
          const lowerName = name.toLowerCase();
          if (lowerName.includes("chùa") || lowerName.includes("tự") || lowerName.includes("miếu")) {
            subCategory = "Tâm linh";
            badgeIcon = "⛩️";
          } else if (lowerName.includes("cáp treo") || lowerName.includes("núi")) {
            subCategory = "Núi cao";
            badgeIcon = "🚠";
          } else if (lowerName.includes("nhà mồ") || lowerName.includes("di tích")) {
            subCategory = "Di tích lịch sử";
            badgeIcon = "🏛️";
          } else if (lowerName.includes("chợ")) {
            subCategory = "Chợ truyền thống";
            badgeIcon = "🛍️";
          } else if (lowerName.includes("khu du lịch") || lowerName.includes("lâm viên")) {
            subCategory = "Khu du lịch";
            badgeIcon = "🏞️";
          }

          // Nếu file không phải loại "Tham quan" -> dùng nhãn & icon theo loại đã chọn
          if (targetTab !== "THAM_QUAN") {
            subCategory = tabMeta.subCategory;
            badgeIcon = tabMeta.badgeIcon;
          }

          const placeId = `excel-${Date.now()}-${index}`;

          importedPlaces.push({
            id: placeId,
            name,
            region,
            tab: targetTab,
            subCategory,
            badgeIcon,
            address,
            latitude,
            longitude,
            rating,
            reviewCount,
            ticketPrice: targetTab === "AM_THUC" ? avgPrice : 0,
            priceLevel: hasPriceColumn ? priceText : "Miễn phí",
            openingHours: "07:00 - 17:30",
            phone: "Đang cập nhật",
            shortDesc:
              targetTab === "THAM_QUAN"
                ? description || `Điểm tham quan nổi bật tại ${region}, An Giang.`
                : "",
            culturalHistory:
              targetTab === "THAM_QUAN"
                ? prominentReview
                  ? `Đánh giá nổi bật từ du khách: "${prominentReview}"`
                  : description
                : "",
            imageUrl: DEFAULT_PLACE_IMAGE_URL,
            tags: [removeVietnameseTones(region).replace(/\s+/g, "_"), "du_lich_an_giang"],
            isVisible: true,
          });

          if (prominentReview) {
            importedReviews.push({
              id: `rev-excel-${Date.now()}-${index}`,
              placeId,
              authorName: "Đánh giá nổi bật (Google Maps)",
              rating: Math.min(5, Math.max(4, Math.round(rating))),
              comment: prominentReview,
              createdAt: "Nổi bật",
            });
          }

          if (region) newRegionNames.add(region);
        });

        // Bỏ qua địa điểm đã có sẵn trong hệ thống (trùng tên + khu vực) hoặc trùng ngay trong file
        const existingKeys = new Set(places.map((p) => makePlaceKey(p.name, p.region)));
        const freshPlaces: PlaceItem[] = [];
        const skippedNames: string[] = [];
        importedPlaces.forEach((p) => {
          const key = makePlaceKey(p.name, p.region);
          if (existingKeys.has(key)) {
            skippedNames.push(p.name);
          } else {
            existingKeys.add(key);
            freshPlaces.push(p);
          }
        });
        const freshIds = new Set(freshPlaces.map((p) => p.id));
        const freshReviews = importedReviews.filter((r) => freshIds.has(r.placeId));

        if (freshPlaces.length === 0 && importedPlaces.length > 0) {
          alert(
            `Tất cả ${importedPlaces.length} địa điểm trong file đã có sẵn trong hệ thống nên không thêm lại.`
          );
        }

        if (freshPlaces.length > 0) {
          // Bổ sung các khu vực mới nếu chưa có
          setRegions((prev) => {
            const existing = new Set(prev.map((r) => normalizeAreaName(r.name)));
            const added: RegionItem[] = [];
            newRegionNames.forEach((regName) => {
              if (!existing.has(normalizeAreaName(regName))) {
                added.push({
                  id: `reg-excel-${Date.now()}-${added.length}`,
                  name: regName,
                  displayLabel: regName,
                });
              }
            });
            return [...prev, ...added];
          });

          // Gộp địa điểm & đánh giá nổi bật vào hệ thống (và tự động lưu vào shared-travel-data.json)
          setPlaces((prev) => [...freshPlaces, ...prev]);
          if (freshReviews.length > 0) {
            setReviews((prev) => [...freshReviews, ...prev]);
          }

          alert(
            `Đã thêm ${freshPlaces.length} địa điểm mới vào mục "${tabMeta.label}".` +
              (skippedNames.length > 0
                ? `\nBỏ qua ${skippedNames.length} địa điểm đã có sẵn: ${skippedNames
                    .slice(0, 8)
                    .join(", ")}${skippedNames.length > 8 ? "..." : ""}`
                : "")
          );

          if (autoFindImages) {
            fetchImagesForPlaces(
              freshPlaces.map((p) => ({
                id: p.id,
                name: p.name,
                region: p.region,
                address: p.address,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        alert("Có lỗi khi đọc file Excel. Hãy kiểm tra lại định dạng file (.xlsx, .xls, .csv)!");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddTagToForm = () => {
    const clean = tagDraft.trim();
    if (!clean) return;
    if (!adminForm.tags.includes(clean)) {
      setAdminForm((prev) => ({ ...prev, tags: [...prev.tags, clean] }));
    }
    setTagDraft("");
  };

  const handleRemoveTagFromForm = (tagToRemove: string) => {
    setAdminForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleAdminSavePlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.address.trim()) return;

    // Chặn thêm/sửa thành địa điểm trùng tên + khu vực với địa điểm đã có
    const formRegion = adminForm.region || regions[0]?.name || "Rạch Giá";
    const duplicate = places.find(
      (p) =>
        p.id !== editingId &&
        makePlaceKey(p.name, p.region) === makePlaceKey(adminForm.name, formRegion)
    );
    if (duplicate) {
      alert(
        `Địa điểm "${duplicate.name}" tại ${duplicate.region} đã có trong hệ thống nên không thêm lại.`
      );
      return;
    }

    const finalImage = adminForm.imageUrl.trim() || DEFAULT_PLACE_IMAGE_URL;

    const computedTicketPrice =
      adminForm.tab === "AM_THUC" ? normalizeAmountVND(Number(adminForm.ticketPrice)) : 0;
    const computedPriceLevel =
      adminForm.tab === "AM_THUC"
        ? normalizePriceText(adminForm.priceLevel) ||
          (computedTicketPrice > 0
            ? formatVND(computedTicketPrice)
            : "Theo thực đơn")
        : adminForm.tab === "NHA_NGHI"
        ? normalizePriceText(adminForm.priceLevel) || "Đang cập nhật"
        : "Miễn phí";

    if (editingId) {
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                ...adminForm,
                imageUrl: finalImage,
                ticketPrice: computedTicketPrice,
                priceLevel: computedPriceLevel,
              }
            : p
        )
      );
      setEditingId(null);
    } else {
      const created: PlaceItem = {
        id: `custom-${Date.now()}`,
        name: adminForm.name,
        region: adminForm.region || regions[0]?.name || "Rạch Giá",
        tab: adminForm.tab,
        subCategory: adminForm.subCategory || "Điểm tham quan",
        badgeIcon: adminForm.badgeIcon || "📍",
        address: adminForm.address,
        latitude: Number(adminForm.latitude),
        longitude: Number(adminForm.longitude),
        rating: 4.9,
        reviewCount: 15,
        ticketPrice: computedTicketPrice,
        priceLevel: computedPriceLevel,
        openingHours: adminForm.openingHours,
        phone: adminForm.phone || "Đang cập nhật",
        shortDesc: adminForm.shortDesc,
        culturalHistory:
          "Điểm đến chính thức được cập nhật bởi Quản trị viên Sổ tay du lịch An Giang.",
        imageUrl: finalImage,
        tags: adminForm.tags.length > 0 ? adminForm.tags : ["du_lich_an_giang"],
        isVisible: true,
      };
      setPlaces((prev) => [created, ...prev]);
    }

    setAdminForm({
      name: "",
      region: regions[0]?.name || "Rạch Giá",
      tab: "THAM_QUAN",
      subCategory: "Di tích lịch sử",
      badgeIcon: "🏛️",
      address: "",
      latitude: 10.0125,
      longitude: 105.0809,
      ticketPrice: 45000,
      priceLevel: "35.000 - 55.000 VND/tô",
      openingHours: "07:00 - 17:30",
      phone: "",
      shortDesc: "",
      imageUrl: "",
      tags: ["di_tich_lich_su", "van_hoa"],
    });
  };

  // --- ADMIN: LỌC & NHÓM DANH SÁCH ĐỊA ĐIỂM THEO TỪNG ĐỊA BÀN ---
  const [adminSearch, setAdminSearch] = useState<string>("");
  const [adminRegionFilter, setAdminRegionFilter] = useState<string>("ALL");
  const [adminTabFilter, setAdminTabFilter] = useState<string>("ALL");
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);
  // Bật = chỉ hiện các địa điểm chưa có ảnh để bổ sung
  const [adminNoImageOnly, setAdminNoImageOnly] = useState<boolean>(false);

  const missingImageCount = useMemo(
    () => places.filter((p) => isMissingImage(p)).length,
    [places]
  );

  const adminFilteredPlaces = useMemo(() => {
    return places.filter((p) => {
      const matchNoImage = !adminNoImageOnly || isMissingImage(p);
      const matchRegion = adminRegionFilter === "ALL" || p.region === adminRegionFilter;
      const matchTab = adminTabFilter === "ALL" || p.tab === adminTabFilter;
      const matchQuery =
        !adminSearch.trim() ||
        matchesVietnameseSearch(p.name, adminSearch) ||
        matchesVietnameseSearch(p.address, adminSearch) ||
        matchesVietnameseSearch(p.subCategory, adminSearch);
      return matchNoImage && matchRegion && matchTab && matchQuery;
    });
  }, [places, adminRegionFilter, adminTabFilter, adminSearch, adminNoImageOnly]);

  const adminGroups = useMemo(() => {
    const byRegion: Record<string, PlaceItem[]> = {};
    adminFilteredPlaces.forEach((p) => {
      (byRegion[p.region] = byRegion[p.region] || []).push(p);
    });
    const order = regions.map((r) => r.name);
    return Object.keys(byRegion)
      .sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib) || a.localeCompare(b, "vi");
      })
      .map((region) => ({ region, items: byRegion[region] }));
  }, [adminFilteredPlaces, regions]);

  const adminRegionChips = useMemo(() => {
    const counts: Record<string, number> = {};
    places.forEach((p) => {
      counts[p.region] = (counts[p.region] || 0) + 1;
    });
    const order = regions.map((r) => r.name);
    return Object.keys(counts)
      .sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib) || a.localeCompare(b, "vi");
      })
      .map((name) => ({ name, count: counts[name] }));
  }, [places, regions]);

  // --- ADMIN: DỌN ĐỊA ĐIỂM NGOÀI 102 XÃ / PHƯỜNG / ĐẶC KHU ---
  const [cleanupPreview, setCleanupPreview] = useState<PlaceItem[] | null>(null);
  const [cleanupRemoveRegions, setCleanupRemoveRegions] = useState<boolean>(false);

  // --- ADMIN: SAO LƯU & KHÔI PHỤC DỮ LIỆU ---
  type BackupEntry = { name: string; size: number; places: number; reason: string; createdAt: string };
  const [backupList, setBackupList] = useState<BackupEntry[] | null>(null);
  const [backupBusy, setBackupBusy] = useState<boolean>(false);
  const [backupNotice, setBackupNotice] = useState<string>("");
  const BACKUP_REASON_LABELS: Record<string, string> = {
    open: "Khi mở web",
    close: "Khi tắt web",
    auto: "Tự động (10 phút)",
    manual: "Sao lưu thủ công",
    startup: "Khi bật máy chủ",
    shutdown: "Khi tắt máy chủ",
    beforerestore: "Trước khi khôi phục",
  };

  const loadBackupList = async () => {
    try {
      const res = await fetch("/api/backup", { cache: "no-store" });
      const data = await res.json();
      setBackupList(Array.isArray(data.backups) ? data.backups : []);
    } catch {
      setBackupNotice("Không đọc được danh sách sao lưu.");
    }
  };

  const handleBackupNow = async () => {
    setBackupBusy(true);
    setBackupNotice("");
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual" }),
      });
      const data = await res.json();
      setBackupNotice(
        data.ok
          ? `✓ Đã sao lưu: ${data.name}`
          : data.skipped === "UNCHANGED"
          ? "Dữ liệu chưa thay đổi so với bản sao lưu mới nhất."
          : data.skipped === "EMPTY_DATA"
          ? "Dữ liệu đang rỗng nên không sao lưu (để không đè lên bản tốt)."
          : "Chưa sao lưu được: " + (data.skipped || data.error || "lỗi không rõ")
      );
      await loadBackupList();
    } catch {
      setBackupNotice("Không gọi được máy chủ để sao lưu.");
    }
    setBackupBusy(false);
  };

  const handleRestoreBackup = async (name: string) => {
    if (
      !window.confirm(
        "Khôi phục dữ liệu từ bản sao lưu này?\nDữ liệu hiện tại sẽ được sao lưu lại trước khi bị thay thế."
      )
    ) {
      return;
    }
    setBackupBusy(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: name }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("Đã khôi phục dữ liệu. Trang sẽ tải lại.");
        window.location.reload();
        return;
      }
      setBackupNotice("Khôi phục thất bại: " + (data.error || "lỗi không rõ"));
    } catch {
      setBackupNotice("Không gọi được máy chủ để khôi phục.");
    }
    setBackupBusy(false);
  };

  const handlePreviewCleanup = () => {
    setCleanupPreview(places.filter((p) => !isInAnGiangAreas(p.region)));
  };

  const handleDownloadCleanupBackup = () => {
    if (!cleanupPreview) return;
    const blob = new Blob([JSON.stringify(cleanupPreview, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dia-diem-ngoai-102-xa-phuong.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmCleanup = () => {
    if (!cleanupPreview || cleanupPreview.length === 0) return;
    const ids = new Set(cleanupPreview.map((p) => p.id));
    if (
      !window.confirm(
        `Xóa vĩnh viễn ${ids.size} địa điểm nằm ngoài 102 xã/phường/đặc khu của An Giang?\nThao tác này không hoàn tác được.`
      )
    ) {
      return;
    }
    setPlaces((prev) => prev.filter((p) => !ids.has(p.id)));
    setReviews((prev) => prev.filter((r) => !ids.has(r.placeId)));
    setPlannerDestIds((prev) => prev.filter((id) => !ids.has(id)));
    setFavorites((prev) => prev.filter((id) => !ids.has(id)));
    if (cleanupRemoveRegions) {
      setRegions((prev) => prev.filter((r) => isInAnGiangAreas(r.name)));
    }
    setSelectedRegion("ALL");
    setAdminRegionFilter("ALL");
    setCleanupPreview(null);
    alert(`Đã xóa ${ids.size} địa điểm.`);
  };

  // Đóng pop up sửa địa điểm và trả form về trạng thái "thêm mới"
  const handleCancelEdit = () => {
    setEditingId(null);
    setAdminForm({
      name: "",
      region: regions[0]?.name || "Rạch Giá",
      tab: "THAM_QUAN",
      subCategory: "Di tích lịch sử",
      badgeIcon: "🏛️",
      address: "",
      latitude: 10.0125,
      longitude: 105.0809,
      ticketPrice: 45000,
      priceLevel: "35.000 - 55.000 VND/tô",
      openingHours: "07:00 - 17:30",
      phone: "",
      shortDesc: "",
      imageUrl: "",
      tags: ["di_tich_lich_su", "van_hoa"],
    });
  };

  // Khóa cuộn trang phía sau khi pop up sửa đang mở
  useEffect(() => {
    if (!editingId) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [editingId]);

  const featuredRegionNames = useMemo(
    () => new Set(regions.slice(0, 10).map((r) => r.name)),
    [regions]
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-800 select-none">
      {/* MÀN HÌNH CHỜ: hiện khi mới vào web, tự tắt khi tải xong dữ liệu */}
      {!isStorageLoaded && <LoadingScreen error={loadError} />}

      {/* ẨN HOÀN TOÀN ICON DEV NEXT.JS */}
      <style>{`
        nextjs-portal,
        [data-nextjs-toast],
        [data-nextjs-dialog-overlay],
        [data-next-badge-root],
        [data-nextjs-dev-tools-button] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>

      {/* =====================================================================
          CỘT SIDEBAR BÊN TRÁI
         ===================================================================== */}
      {/* THANH TRÊN CÙNG DÀNH CHO ĐIỆN THOẠI (logo • chọn khu vực • hotline) */}
      <header className="md:hidden sticky top-0 z-30 bg-[#7995B2] px-3 py-2.5 shadow-lg flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTab("HOME")}
          title="Về trang chính"
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 via-emerald-500 to-sky-600 flex items-center justify-center text-white border border-white/60 shrink-0"
        >
          <Compass className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <SearchableRegionSelect
            regions={regions}
            places={tabScopedPlaces}
            value={selectedRegion}
            onChange={(reg) => {
              setSelectedRegion(reg);
              if (activeTab === "HOME") setActiveTab("THAM_QUAN");
            }}
            includeAllOption={true}
            allOptionLabel={allRegionLabel}
            variant="sidebar"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowEmergencyModal(true)}
          title="Đường dây nóng khẩn cấp"
          className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow"
        >
          <PhoneCall className="w-4 h-4" />
        </button>
      </header>

      <aside className="hidden md:flex md:w-[235px] md:fixed md:left-0 md:top-0 md:h-screen md:overflow-hidden bg-[#7995B2] border-r border-white/30 p-3 flex-col justify-between shrink-0 shadow-xl z-20">
        <div className="space-y-2.5">
          {/* ICON WEB Ở GÓC TRÊN CÙNG: BẤM VÀO ĐỂ VỀ MENU CHÍNH ("HOME") */}
          <div
            onClick={() => setActiveTab("HOME")}
            title="Bấm vào để về Menu chính"
            className="flex items-center gap-3 px-2 pt-1 pb-2 border-b border-white/25 cursor-pointer group"
          >
            <img
              src="/logo.png"
              alt="An Giang - Sổ Tay Du Lịch Số"
              className="w-10 h-10 object-contain drop-shadow-md group-hover:scale-110 transition"
            />
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-wide leading-tight drop-shadow-sm">
                AN GIANG
              </h1>
              <p className="text-[11px] text-sky-100 font-medium">Sổ Tay Du Lịch Số</p>
            </div>
          </div>

          {/* NÚT CHỌN KHU VỰC CÓ Ô GÕ TÌM NHANH */}
          <div className="pt-1">
            <SearchableRegionSelect
              regions={regions}
              places={tabScopedPlaces}
              value={selectedRegion}
              onChange={(reg) => {
                setSelectedRegion(reg);
                if (activeTab === "HOME") setActiveTab("THAM_QUAN");
              }}
              includeAllOption={true}
              allOptionLabel={allRegionLabel}
              variant="sidebar"
            />
          </div>

          {/* DANH SÁCH NÚT CHỨC NĂNG */}
          <nav className="space-y-1.5 pt-0.5">
            {[
              { id: "THAM_QUAN", label: tabLabels.THAM_QUAN || "Tham Quan", icon: BookOpen },
              { id: "BAN_DO", label: tabLabels.BAN_DO || "Bản đồ", icon: Map },
              { id: "AM_THUC", label: tabLabels.AM_THUC || "Ẩm thực", icon: Utensils },
              { id: "NHA_NGHI", label: tabLabels.NHA_NGHI || "Nhà nghỉ", icon: Bed },
              { id: "MUA_SAM", label: tabLabels.MUA_SAM || "Mua sắm", icon: ShoppingBag },
              { id: "LE_HOI", label: tabLabels.LE_HOI || "Lễ hội", icon: Sparkles },
              { id: "OCOP", label: tabLabels.OCOP || "Sản phẩm OCOP", icon: Award },
              {
                id: "HANH_TRINH",
                label: `${tabLabels.HANH_TRINH || "Hành trình"} (${plannerDestIds.length})`,
                icon: Calendar,
              },
              { id: "CAM_NANG", label: tabLabels.CAM_NANG || "Cẩm nang", icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as FunctionalTab)}
                  className={`w-full py-2 px-4 rounded-2xl font-bold text-[14px] [@media(max-height:820px)]:py-1.5 [@media(max-height:820px)]:text-[13px] flex items-center gap-3 transition-all duration-200 ${
                    isActive
                      ? "bg-[#6A86A3] text-slate-900 shadow-inner border border-slate-500/40"
                      : "bg-[#EAEFF3] hover:bg-white text-slate-800 shadow-md border border-white/80"
                  }`}
                >
                  <Icon className="w-5 h-5 text-slate-700 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            {isAdminAuthenticated && (
              <button
                onClick={() => setActiveTab("ADMIN")}
                className={`w-full py-2 px-4 rounded-2xl font-bold text-[14px] [@media(max-height:820px)]:py-1.5 [@media(max-height:820px)]:text-[13px] flex items-center gap-3 transition-all duration-200 ${
                  activeTab === "ADMIN"
                    ? "bg-amber-400 text-slate-950 shadow-lg border border-amber-300"
                    : "bg-slate-900 text-amber-300 hover:bg-slate-800 shadow-md"
                }`}
              >
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>Admin CMS</span>
              </button>
            )}
          </nav>
        </div>

        {/* ĐỊNH VỊ GPS & NÚT HOTLINE KHẨN CẤP Ở ĐÁY SIDEBAR */}
        <div className="mt-2 pt-2 border-t border-white/25 text-[11px] text-white/90 space-y-1.5">
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="w-full py-1.5 px-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold flex items-center justify-center gap-1.5 shadow transition"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Đường dây nóng khẩn cấp</span>
          </button>

          <div className="flex items-center gap-1.5 font-semibold pt-1 [@media(max-height:760px)]:hidden">
            <Navigation className="w-3.5 h-3.5 text-amber-200 shrink-0" />
            <span className="truncate">{userLocation.label}</span>
          </div>
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setUserLocation({
                    lat: Number(pos.coords.latitude.toFixed(4)),
                    lng: Number(pos.coords.longitude.toFixed(4)),
                    label: "GPS hiện tại của bạn",
                  });
                });
              }
            }}
            className="w-full py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-center transition [@media(max-height:760px)]:hidden"
          >
            Cập nhật vị trí GPS
          </button>
        </div>
      </aside>

      {/* =====================================================================
          KHU VỰC NỘI DUNG PHẢI
         ===================================================================== */}
      <main
        className="flex-1 min-w-0 relative min-h-screen md:ml-[235px] bg-cover bg-center md:bg-fixed flex flex-col justify-between"
        style={{
          backgroundImage: `url('/bg-beach.jpg'), url('${HERO_BG_URL}')`,
        }}
      >
        <div className="absolute inset-0 bg-sky-950/10 pointer-events-none" />

        <div className="relative z-10 px-3 pt-3 pb-28 sm:px-6 sm:pt-6 md:px-8 md:py-5 space-y-4 md:space-y-5 max-w-[1440px] w-full mx-auto">
          {/* TOP BAR: THANH TÌM KIẾM KHÔNG DẤU + GIỌNG NÓI (VOICE SEARCH) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full sm:w-80 md:w-[420px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab === "HOME" && e.target.value.trim() !== "") {
                    setActiveTab("THAM_QUAN");
                  }
                }}
                placeholder="Tìm Kiếm"
                className="w-full pl-10 pr-20 py-2 rounded-full bg-white/95 backdrop-blur-md text-slate-800 placeholder-slate-400 text-sm font-medium shadow-md border border-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <div className="absolute right-2 top-1.5 flex items-center gap-1">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleVoiceSearch}
                  title="Tìm kiếm bằng giọng nói Tiếng Việt"
                  className={`p-1.5 rounded-full transition ${
                    isListening
                      ? "bg-rose-600 text-white animate-pulse"
                      : "bg-slate-100 hover:bg-teal-100 text-teal-700"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>

              {voiceNotice && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-30 px-3 py-1.5 rounded-xl bg-teal-900 text-white text-xs flex items-center gap-2 shadow-lg">
                  <Volume2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>{voiceNotice}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {currentUser ? (
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-md border border-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Xin chào, {currentUser.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="ml-2 text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Thoát
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRegError("");
                      setShowRegisterModal(true);
                    }}
                    className="px-6 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white text-slate-900 font-bold text-sm shadow-md border border-white/80 transition"
                  >
                    Đăng Ký
                  </button>
                  <button
                    onClick={() => {
                      setLoginError("");
                      setShowLoginModal(true);
                    }}
                    className="px-6 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white text-slate-900 font-bold text-sm shadow-md border border-white/80 transition"
                  >
                    Đăng Nhập
                  </button>
                </>
              )}
            </div>
          </div>

          {/* =================================================================
              CHẾ ĐỘ MENU CHÍNH ("HOME"): CHỈ HIỂN THỊ KHI VỪA VÀO WEB HOẶC BẤM ICON LA BÀN
             ================================================================= */}
          {activeTab === "HOME" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-white/85 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-xl border border-white my-4">
              <div className="lg:col-span-7 space-y-4">
                <span className="inline-block bg-teal-100 text-teal-900 text-xs font-bold px-3.5 py-1 rounded-full border border-teal-200">
                  🌐 CẨM NANG DU LỊCH ĐỒNG BẰNG SÔNG CỬU LONG & BIỂN ĐẢO TÂY NAM
                </span>
                <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  SỔ TAY DU LỊCH AN GIANG
                </h1>
                <p className="text-sm md:text-base font-bold text-teal-900 flex items-center gap-2">
                  <span>Đi đâu</span> • <span>Ăn gì</span> • <span>Ở đâu</span> •{" "}
                  <span>Đi thế nào?</span>
                </p>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  Cơ sở dữ liệu bao trùm toàn diện địa bàn tỉnh An Giang mới (14 phường, 85 xã, 3
                  đặc khu) trên nền tảng ấn phẩm{" "}
                  <strong>&quot;Sổ tay du lịch An Giang&quot;</strong> (NXB Thông Tấn) và các dữ
                  liệu khảo cứu thực địa bổ sung.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("THAM_QUAN")}
                    className="p-3.5 rounded-2xl bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-400 shadow-sm text-left transition cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-teal-700 mb-1.5" />
                    <span className="font-bold text-xs text-slate-900 block">Đi đâu?</span>
                    <span className="text-[10px] text-slate-500">
                      Xem {publicPlaces.filter((p) => p.isVisible && p.tab === "THAM_QUAN").length} điểm
                      đến
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("AM_THUC")}
                    className="p-3.5 rounded-2xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 shadow-sm text-left transition cursor-pointer"
                  >
                    <Utensils className="w-4 h-4 text-amber-600 mb-1.5" />
                    <span className="font-bold text-xs text-slate-900 block">Ăn gì?</span>
                    <span className="text-[10px] text-slate-500">Món ngon & Bảng giá</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("NHA_NGHI")}
                    className="p-3.5 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-400 shadow-sm text-left transition cursor-pointer"
                  >
                    <Bed className="w-4 h-4 text-sky-600 mb-1.5" />
                    <span className="font-bold text-xs text-slate-900 block">Ở đâu?</span>
                    <span className="text-[10px] text-slate-500">Resort & Khách sạn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("HANH_TRINH")}
                    className="p-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white shadow-sm text-left transition cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-white mb-1.5" />
                    <span className="font-bold text-xs block">Đi thế nào?</span>
                    <span className="text-[10px] text-teal-100">Lập lịch & Chi phí</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 w-full">
                <AnGiangOverviewCard
                  onSelectRegion={(regName) => {
                    setSelectedRegion(regName);
                    setActiveTab("THAM_QUAN");
                  }}
                />
              </div>
            </div>
          )}

          {/* ĐỊA ĐIỂM NỔI TIẾNG (⭐) GẦN BẠN - MENU CHÍNH */}
          {activeTab === "HOME" && (
            <FeaturedPlacesHome
              places={publicPlaces}
              userLocation={userLocation}
              isAdmin={isAdminAuthenticated}
              onOpenPlace={openPlace}
              onLocateMe={requestGps}
            />
          )}

          {/* THANH CHỌN NHANH KHU VỰC (ẨN Ở MENU CHÍNH HOME) */}
          {activeTab !== "HOME" &&
            activeTab !== "BAN_DO" &&
            activeTab !== "HANH_TRINH" &&
            activeTab !== "CAM_NANG" &&
            activeTab !== "ADMIN" && (
              <div className="sticky top-[66px] md:top-4 z-20 bg-white/80 backdrop-blur-xl backdrop-saturate-150 px-3.5 py-2.5 sm:px-5 sm:py-3.5 rounded-3xl shadow-[0_8px_32px_rgba(15,23,42,0.22)] border border-white/70 ring-1 ring-black/5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-700">Chọn khu vực khám phá:</span>
                    <div className="relative w-60">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={quickRegionFilter}
                        onChange={(e) => setQuickRegionFilter(e.target.value)}
                        placeholder="Tìm Kiếm"
                        className="w-full pl-8 pr-6 py-1 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      {quickRegionFilter && (
                        <button
                          type="button"
                          onClick={() => setQuickRegionFilter("")}
                          className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(selectedRegion !== "ALL" ||
                    searchQuery.trim() !== "" ||
                    quickRegionFilter.trim() !== "") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegion("ALL");
                        setSearchQuery("");
                        setQuickRegionFilter("");
                      }}
                      className="text-rose-600 hover:text-rose-700 hover:underline font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Xóa bộ lọc</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedRegion("ALL")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 border ${
                      selectedRegion === "ALL"
                        ? "bg-[#047857] text-white border-[#047857] font-bold shadow-sm"
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {allRegionLabel} ({tabScopedPlaces.filter((p) => p.isVisible).length})
                  </button>

                  {regions
                    .filter((reg) => {
                      if (quickRegionFilter.trim()) {
                        return (
                          matchesVietnameseSearch(reg.name, quickRegionFilter) ||
                          matchesVietnameseSearch(reg.displayLabel, quickRegionFilter)
                        );
                      }
                      return (
                        featuredRegionNames.has(reg.name) ||
                        selectedRegion === reg.name ||
                        tabScopedPlaces.some((p) => p.isVisible && p.region === reg.name)
                      );
                    })
                    .sort((a, b) => {
                      const rank = (r: RegionItem) => {
                        const i = REGION_CHIP_PRIORITY.indexOf(normalizeAreaName(r.name));
                        return i === -1 ? REGION_CHIP_PRIORITY.length : i;
                      };
                      return rank(a) - rank(b);
                    })
                    .map((reg) => {
                      const count = tabScopedPlaces.filter(
                        (p) => p.isVisible && p.region === reg.name
                      ).length;
                      const isSelected = selectedRegion === reg.name;

                      return (
                        <button
                          key={reg.id}
                          type="button"
                          onClick={() => setSelectedRegion(reg.name)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                            isSelected
                              ? "bg-[#047857] text-white border-[#047857] font-bold shadow-sm"
                              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          <span>{reg.displayLabel}</span>
                          <span
                            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                              isSelected
                                ? "bg-white/25 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

          {activeTab !== "HOME" && (
            <div className="text-center pt-1 pb-2">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 drop-shadow-[0_2px_10px_rgba(255,255,255,0.85)]">
                {activeTab === "THAM_QUAN"
                  ? `Các Địa điểm ${tabLabels.THAM_QUAN}`
                  : activeTab === "AM_THUC"
                  ? `Khám Phá ${tabLabels.AM_THUC}`
                  : activeTab === "NHA_NGHI"
                  ? `Địa Điểm ${tabLabels.NHA_NGHI}`
                  : activeTab === "MUA_SAM"
                  ? `Địa Điểm ${tabLabels.MUA_SAM}`
                  : activeTab === "LE_HOI"
                  ? `${tabLabels.LE_HOI} & Văn Hóa`
                  : activeTab === "OCOP"
                  ? `${tabLabels.OCOP || "Sản phẩm OCOP"} 5 Sao & 4 Sao An Giang`
                  : activeTab === "HANH_TRINH"
                  ? "Lập Hành Trình & Dự Toán Chi Phí Chính Xác"
                  : activeTab === "CAM_NANG"
                  ? "20 Quy Tắc Ứng Xử Văn Minh Du Lịch An Giang"
                  : "Hệ Thống Quản Trị Dữ Liệu (Admin CMS)"}
              </h2>
            </div>
          )}

          {/* =================================================================
              CHẾ ĐỘ 1: LƯỚI CARD ĐỊA ĐIỂM
             ================================================================= */}
          {activeTab !== "HOME" &&
            activeTab !== "HANH_TRINH" &&
            activeTab !== "CAM_NANG" &&
            activeTab !== "ADMIN" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredPlaces.map((place) => {
                  const isFav = favorites.includes(place.id);
                  const inPlanner = plannerDestIds.includes(place.id);
                  return (
                    <div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      className="bg-[#DCE8F0]/90 backdrop-blur-md rounded-[22px] p-2.5 shadow-xl border border-white/80 hover:scale-[1.01] transition-all duration-200 cursor-pointer flex flex-col justify-between"
                    >
                      <div className="relative h-44 rounded-[16px] overflow-hidden bg-slate-200">
                        <img
                          src={place.imageUrl}
                          alt={place.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoritePlace(place.id);
                          }}
                          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-900/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-slate-900"
                          title="Lưu yêu thích"
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              isFav ? "fill-rose-500 text-rose-500" : "text-white"
                            }`}
                          />
                        </button>

                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/55 text-white flex items-center justify-center hover:bg-slate-900">
                          <ChevronRight className="w-4 h-4" />
                        </span>

                        <span className="absolute bottom-2.5 left-2.5 bg-[#204E4A]/90 backdrop-blur-sm text-white text-xs font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5 border border-white/30 shadow-md">
                          <span>{place.subCategory}</span>
                          <span>{place.badgeIcon}</span>
                        </span>
                      </div>

                      <div className="bg-[#F5F7F8] rounded-[16px] p-3.5 mt-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-[16px] text-slate-900 leading-snug line-clamp-2">
                            {place.name}
                          </h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlannerDestIds((prev) =>
                                  prev.includes(place.id)
                                    ? prev.filter((id) => id !== place.id)
                                    : [...prev, place.id]
                                );
                              }}
                              title={inPlanner ? "Đã có trong hành trình" : "Thêm vào hành trình"}
                              className={`w-8 h-8 sm:w-6 sm:h-6 rounded flex items-center justify-center text-sm sm:text-xs font-bold ${
                                inPlanner
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-200/80 hover:bg-teal-100 text-slate-700"
                              }`}
                            >
                              {inPlanner ? "✓" : "+"}
                            </button>
                            <a
                              href={buildGoogleMapsSearchUrl(place)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Tìm địa điểm này trên Google Maps"
                              className="w-8 h-8 sm:w-6 sm:h-6 rounded bg-slate-200/80 hover:bg-emerald-100 text-slate-700 flex items-center justify-center"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-1 text-xs text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="font-semibold">{place.region}</span>
                          <span className="text-teal-700 font-bold">
                            • {formatApproxKm(place.distanceKm)}
                          </span>
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i <= Math.round(normalizeRating(place.rating))
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-slate-300"
                                }`}
                              />
                            ))}
                            <span className="text-[11px] text-slate-600 font-semibold ml-0.5">
                              {normalizeRating(place.rating)}/5 (
                              {place.reviewCount.toLocaleString("vi-VN")})
                            </span>
                          </div>
                        </div>

                        {/* GIÁ PHÒNG THAM KHẢO CHO NHÀ NGHỈ */}
                        {place.tab === "NHA_NGHI" && (
                          <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs">
                            <span className="text-slate-600 font-medium">💰 Giá tham khảo:</span>
                            <span className="font-extrabold text-amber-800">
                              {getStayPriceText(place)}
                            </span>
                          </div>
                        )}

                        {/* CHỈ HIỂN THỊ GIÁ MÓN ĂN KHI ĐỊA ĐIỂM THUỘC TAB ẨM THỰC */}
                        {place.tab === "AM_THUC" && (
                          <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs">
                            <span className="text-slate-600 font-medium">🍴 Giá món:</span>
                            <span className="font-extrabold text-amber-800">
                              {getFoodPriceText(place)}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {place.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 rounded-full bg-[#E3EAEF] text-slate-700 text-[11px] font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* =================================================================
              CHẾ ĐỘ BẢN ĐỒ DU LỊCH TƯƠNG TÁC (LEAFLET + OPENSTREETMAP)
             ================================================================= */}
          {activeTab === "BAN_DO" && (
            <InteractiveAnGiangMap
              places={publicPlaces}
              plannerPlaces={selectedPlannerPlaces}
              transitHubs={transitHubs}
              userLocation={userLocation}
              onSelectPlace={(p) => openPlace(p.id)}
              onGoToPlanner={() => setActiveTab("HANH_TRINH")}
              onLocateMe={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    setUserLocation({
                      lat: Number(pos.coords.latitude.toFixed(4)),
                      lng: Number(pos.coords.longitude.toFixed(4)),
                      label: "Vị trí GPS hiện tại của bạn",
                    });
                  });
                }
              }}
            />
          )}

          {/* =================================================================
              CHẾ ĐỘ 2: LẬP HÀNH TRÌNH 4 BƯỚC, DỰ TOÁN CHI PHÍ & LƯU CHUYẾN ĐI
             ================================================================= */}
          {activeTab === "HANH_TRINH" && (
            <div className="space-y-7">
              {(() => {
                const inputCls =
                  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500";
                const labelCls = "block text-xs font-semibold text-slate-600 mb-1";
                const cardCls =
                  "bg-[#F5F7F8] p-4 sm:p-5 rounded-[18px] shadow-xl ring-8 ring-[#DCE8F0]/90 border border-white/80";
                const primaryBtn =
                  "px-7 py-2.5 rounded-full bg-[#047857] hover:bg-emerald-800 text-white font-bold text-sm shadow-md border border-white/30 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed";
                const ghostBtn =
                  "px-6 py-2.5 rounded-full bg-[#EBF1F5]/95 hover:bg-white text-slate-900 font-bold text-sm shadow-md border border-white/80 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed";
                const steps: { n: 1 | 2 | 3 | 4; label: string }[] = [
                  { n: 1, label: "Nhu cầu" },
                  { n: 2, label: "Điểm đến" },
                  { n: 3, label: "Chi phí" },
                  { n: 4, label: "Kết quả" },
                ];
                const hasStops = plannerDestIds.length > 0;

                const renderLegs = (legs: TripSeg[]) =>
                  legs.length === 0 ? null : (
                    <div className="border-l border-dashed border-slate-300 pl-3 ml-1 space-y-1 py-1">
                      {legs.map((l, i) =>
                        l.kind === "drive" ? (
                          <div key={i} className="text-[11px] text-slate-500">
                            🚗 {l.km.toLocaleString("vi-VN")} km · {fmtDuration(l.min)}
                            {l.toName ? ` → ${l.toName}` : ""}
                          </div>
                        ) : (
                          <div key={i} className="text-[11px] text-sky-700 font-semibold">
                            ⛴️ Chặng tàu/phà: {l.from} → {l.to} · {l.km} km · {fmtDuration(l.min)} ·{" "}
                            {formatDong(adultFerryPrice)}/người lớn
                          </div>
                        )
                      )}
                    </div>
                  );

                return (
                  <>
                    {/* THANH 4 BƯỚC (cùng kiểu thanh chọn nhanh khu vực) */}
                    <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-md border border-white/80 space-y-2">
                      <p className="text-xs text-slate-600">
                        Chọn điểm đến, sắp xếp theo ngày và ước tính chi phí chuyến đi An Giang với quãng
                        đường bộ và chặng tàu phà thực tế.
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-0.5">
                        {steps.map((s) => {
                          const active = plannerStep === s.n;
                          return (
                            <button
                              key={s.n}
                              type="button"
                              onClick={() => setPlannerStep(s.n)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                                active
                                  ? "bg-[#047857] text-white border-[#047857] font-bold shadow-sm"
                                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium"
                              }`}
                            >
                              <span
                                className={`text-[11px] px-1.5 rounded-full font-bold ${
                                  active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {s.n}
                              </span>
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ===== BƯỚC 1: NHU CẦU ===== */}
                    {plannerStep === 1 && (
                      <div className="space-y-7">
                        <div className={`${cardCls} space-y-4`}>
                          <h3 className="text-xl font-bold text-slate-900">Nhu cầu chuyến đi</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className={labelCls}>Điểm xuất phát</label>
                              <select
                                value={originName}
                                onChange={(e) => setOriginName(e.target.value)}
                                className={inputCls}
                              >
                                {TRIP_ORIGINS.map((o) => (
                                  <option key={o.name} value={o.name}>
                                    {o.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Ngày đi</label>
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Số ngày</label>
                              <select
                                value={plannerDays}
                                onChange={(e) => setPlannerDays(Number(e.target.value))}
                                className={inputCls}
                              >
                                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                  <option key={n} value={n}>
                                    {n === 1 ? "1 ngày" : `${n} ngày ${n - 1} đêm`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className={labelCls}>Giờ khởi hành mỗi ngày</label>
                              <input
                                type="time"
                                value={dayStartTime}
                                onChange={(e) => setDayStartTime(e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Giờ kết thúc mỗi ngày</label>
                              <input
                                type="time"
                                value={dayEndTime}
                                onChange={(e) => setDayEndTime(e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Nhịp độ</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {(
                                  [
                                    ["slow", "Thư thả"],
                                    ["normal", "Vừa phải"],
                                    ["busy", "Nhiều trải nghiệm"],
                                  ] as [PaceKind, string][]
                                ).map(([k, label]) => (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => setPace(k)}
                                    className={`px-1.5 py-2 rounded-xl border text-[11px] sm:text-xs font-bold leading-tight transition cursor-pointer ${
                                      pace === k
                                        ? "bg-[#047857] text-white border-[#047857] shadow-sm"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <PlannerNumberField
                              label="Người lớn"
                              value={adultCount}
                              min={1}
                              onChange={setAdultCount}
                            />
                            <PlannerNumberField
                              label="Trẻ em (dưới 12 tuổi)"
                              value={childCount}
                              onChange={setChildCount}
                            />
                            <PlannerNumberField
                              label="Ngân sách dự kiến cả đoàn"
                              value={expectedBudget}
                              step={100000}
                              suffix="đ"
                              onChange={setExpectedBudget}
                            />

                            <div>
                              <label className={labelCls}>Phương tiện chính</label>
                              <select
                                value={vehicleType}
                                onChange={(e) =>
                                  setVehicleType(
                                    e.target.value as "personal_car" | "motorbike" | "rental_car"
                                  )
                                }
                                className={inputCls}
                              >
                                <option value="personal_car">Ô tô cá nhân</option>
                                <option value="motorbike">Xe máy</option>
                                <option value="rental_car">Thuê ô tô</option>
                              </select>
                            </div>
                            <PlannerNumberField
                              label="Số xe"
                              value={vehicleCount}
                              min={1}
                              onChange={setVehicleCount}
                            />
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:self-end sm:pb-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={roundTrip}
                                onChange={(e) => setRoundTrip(e.target.checked)}
                                className="w-4 h-4 accent-emerald-700"
                              />
                              Quay về điểm xuất phát
                            </label>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button type="button" disabled className={ghostBtn}>
                            Quay lại
                          </button>
                          <button type="button" onClick={() => setPlannerStep(2)} className={primaryBtn}>
                            Tiếp tục
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ===== BƯỚC 2: ĐIỂM ĐẾN ===== */}
                    {plannerStep === 2 && (
                      <div className="space-y-7">
                        <div className={`${cardCls} space-y-4`}>
                          <h3 className="text-xl font-bold text-slate-900">
                            Chọn và sắp xếp điểm đến
                          </h3>

                          {!hasStops ? (
                            <p className="text-sm text-slate-500">
                              Chưa chọn điểm nào. Tìm và thêm điểm đến ở ô bên dưới, hoặc bấm &quot;Thêm
                              vào hành trình&quot; ở trang điểm đến.
                            </p>
                          ) : (
                            <ol className="space-y-2">
                              {selectedPlannerPlaces.map((p, idx) => {
                                const isIsland = Boolean(islandOfRegion(p.region));
                                return (
                                  <li
                                    key={p.id}
                                    className="flex items-center gap-3 p-2 rounded-[16px] bg-white border border-slate-200 shadow-sm"
                                  >
                                    <span className="w-7 h-7 rounded-full bg-[#204E4A] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <img
                                      src={p.imageUrl}
                                      alt={p.name}
                                      referrerPolicy="no-referrer"
                                      className="w-14 h-11 object-cover rounded-xl bg-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-sm text-slate-900 truncate">{p.name}</p>
                                      <p className="text-[11px] text-slate-500 truncate">
                                        {p.region} • {p.subCategory}
                                        {isIsland ? " • ⛴️ Cần đi tàu/phà" : ""}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => movePlannerStop(idx, -1)}
                                        className="w-8 h-8 rounded-lg bg-[#EBF1F5] border border-white hover:bg-white disabled:opacity-30 text-sm"
                                        title="Đưa lên"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === selectedPlannerPlaces.length - 1}
                                        onClick={() => movePlannerStop(idx, 1)}
                                        className="w-8 h-8 rounded-lg bg-[#EBF1F5] border border-white hover:bg-white disabled:opacity-30 text-sm"
                                        title="Đưa xuống"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPlannerDestIds((prev) => prev.filter((id) => id !== p.id))
                                        }
                                        className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm"
                                        title="Bỏ khỏi hành trình"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          )}

                          <TripPlacePicker
                            places={places}
                            regions={regions}
                            tabLabels={tabLabels}
                            excludeIds={plannerDestIds}
                            onAdd={(id) =>
                              setPlannerDestIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                            }
                          />
                          <p className="text-[11px] text-slate-400">
                            Mẹo: thêm cả quán ăn hoặc nhà nghỉ nếu bạn đã chọn sẵn. Nếu không, hệ thống sẽ
                            tự gợi ý nơi nghỉ đêm và quán ăn gần điểm tham quan.
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <button type="button" onClick={() => setPlannerStep(1)} className={ghostBtn}>
                            Quay lại
                          </button>
                          <button
                            type="button"
                            disabled={!hasStops}
                            onClick={() => setPlannerStep(3)}
                            className={primaryBtn}
                          >
                            Tiếp tục
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ===== BƯỚC 3: CHI PHÍ ===== */}
                    {plannerStep === 3 && (
                      <div className="space-y-7">
                        <div className={`${cardCls} space-y-4`}>
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">Thông số chi phí</h3>
                            <p className="text-sm text-slate-500">
                              Các con số dưới đây là giả định ban đầu. Hãy sửa theo thực tế của đoàn.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <PlannerNumberField
                              label="Mức tiêu hao nhiên liệu (lít/100 km)"
                              value={fuelConsumption}
                              step={0.1}
                              onChange={setFuelConsumption}
                            />
                            <PlannerNumberField
                              label="Giá nhiên liệu (đ/lít)"
                              value={fuelPrice}
                              step={500}
                              onChange={setFuelPrice}
                            />
                            <PlannerNumberField
                              label="Phí cầu đường mỗi xe"
                              value={tollFees}
                              step={10000}
                              suffix="đ"
                              onChange={setTollFees}
                            />
                            <PlannerNumberField
                              label="Phí gửi xe mỗi xe"
                              value={parkingFees}
                              step={10000}
                              suffix="đ"
                              onChange={setParkingFees}
                            />
                            <PlannerNumberField
                              label="Ăn uống mỗi người mỗi ngày"
                              value={foodPerPersonDay}
                              step={10000}
                              suffix="đ"
                              onChange={setFoodPerPersonDay}
                            />
                            <PlannerNumberField
                              label="Giá phòng mỗi đêm"
                              value={roomPricePerNight}
                              step={50000}
                              suffix="đ"
                              onChange={setRoomPricePerNight}
                            />
                            <PlannerNumberField
                              label="Số phòng"
                              value={roomCount}
                              onChange={setRoomCount}
                            />
                            <PlannerNumberField
                              label="Vé tham quan cả đoàn"
                              value={ticketOverride ?? autoTicketTotal}
                              step={10000}
                              suffix="đ"
                              onChange={setTicketOverride}
                              hint="Tự cộng từ giá vé các điểm đã chọn, bạn có thể sửa."
                            />
                            <PlannerNumberField
                              label="Vui chơi và mua sắm"
                              value={funShopCost}
                              step={50000}
                              suffix="đ"
                              onChange={setFunShopCost}
                            />
                            <PlannerNumberField
                              label="Dự phòng (%)"
                              value={contingencyPercent}
                              suffix="%"
                              onChange={setContingencyPercent}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button type="button" onClick={() => setPlannerStep(2)} className={ghostBtn}>
                            Quay lại
                          </button>
                          <button type="button" onClick={() => setPlannerStep(4)} className={primaryBtn}>
                            Tiếp tục
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ===== BƯỚC 4: KẾT QUẢ ===== */}
                    {plannerStep === 4 && (
                      <div id="trip-print-area" className="space-y-7">
                        <style>{`@media print { body * { visibility: hidden !important; } #trip-print-area, #trip-print-area * { visibility: visible !important; } #trip-print-area { position: absolute; left: 0; top: 0; width: 100%; background: #fff; padding: 12px; } .trip-no-print { display: none !important; } }`}</style>

                        <div className={`${cardCls} space-y-3`}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1">
                              <label className="block text-[11px] font-bold text-slate-500 uppercase">
                                Tên chuyến đi
                              </label>
                              <input
                                type="text"
                                value={tripTitle}
                                onChange={(e) => setTripTitle(e.target.value)}
                                placeholder="VD: Khám phá Rạch Giá - Phú Quốc 3N2Đ"
                                className="w-full mt-0.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>
                          </div>
                          <div className="trip-no-print flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleAiPlan}
                              disabled={aiLoading}
                              className="px-4 py-2 rounded-full bg-[#204E4A] hover:bg-teal-900 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-md border border-white/30 cursor-pointer"
                            >
                              {aiLoading
                                ? "⏳ AI đang soạn lịch trình..."
                                : aiPlan
                                ? "✨ AI soạn lại"
                                : "✨ Nhờ AI soạn lịch trình"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!hasStops) {
                                  alert("Hãy thêm ít nhất 1 địa điểm trước khi lưu!");
                                  return;
                                }
                                setSavedTrips((prev) => [buildTripPayload(), ...prev]);
                                setSaveTripSuccess(true);
                                setTimeout(() => setSaveTripSuccess(false), 3000);
                              }}
                              className="px-4 py-2 rounded-full bg-[#047857] hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-md border border-white/30 cursor-pointer"
                            >
                              {saveTripSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                              {saveTripSuccess ? "Đã lưu hành trình!" : "Lưu hành trình"}
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyShareLink}
                              className="px-4 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white border border-white/80 shadow-md text-xs font-bold cursor-pointer"
                            >
                              {linkCopied ? "✓ Đã sao chép liên kết" : "🔗 Sao chép liên kết chia sẻ"}
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyTripText}
                              className="px-4 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white border border-white/80 shadow-md text-xs font-bold cursor-pointer"
                            >
                              {tripCopied ? "✓ Đã sao chép" : "📋 Sao chép nội dung"}
                            </button>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="px-4 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white border border-white/80 shadow-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> In / lưu PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab("BAN_DO")}
                              className="px-4 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white border border-white/80 shadow-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" /> Xem trên bản đồ
                            </button>
                            <a
                              href={googleMapsRouteUrl()}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 rounded-full bg-[#EBF1F5]/95 hover:bg-white border border-white/80 shadow-md text-xs font-bold flex items-center gap-1.5"
                            >
                              <Navigation className="w-3.5 h-3.5" /> Mở lộ trình trên Google Maps
                            </a>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                            <span className="px-3 py-1 rounded-full bg-[#E3EAEF] text-slate-700 font-medium">
                              📅 {plannerDays} ngày
                            </span>
                            <span className="px-3 py-1 rounded-full bg-[#E3EAEF] text-slate-700 font-medium">
                              👥 {adultCount} người lớn{childCount > 0 ? ` + ${childCount} trẻ em` : ""}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-[#E3EAEF] text-slate-700 font-medium">
                              🚗 {vehicleLabel} × {vehicleCount}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-[#E3EAEF] text-slate-700 font-medium">
                              📍 Xuất phát: {originName}
                            </span>
                          </div>
                        </div>

                        {aiError && (
                          <div className="trip-no-print px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                            {aiError}
                          </div>
                        )}

                        {aiPlan && (
                          <div className={`${cardCls} space-y-3`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-lg font-bold text-teal-900">
                                ✨ Lịch trình do AI gợi ý
                              </h3>
                              {aiPrevOrder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlannerDestIds(aiPrevOrder);
                                    setAiPrevOrder(null);
                                  }}
                                  className="trip-no-print px-3 py-1 rounded-full bg-[#EBF1F5] border border-white hover:bg-white shadow-sm text-[11px] font-bold cursor-pointer"
                                >
                                  ↩ Hoàn tác thứ tự điểm
                                </button>
                              )}
                            </div>
                            {aiPlan.overview && (
                              <p className="text-sm text-slate-700">{aiPlan.overview}</p>
                            )}
                            <div className="space-y-2">
                              {aiPlan.days.map((d) => (
                                <div
                                  key={d.day}
                                  className="p-3 rounded-[16px] bg-white border border-slate-200 space-y-1"
                                >
                                  <p className="text-sm font-bold text-slate-900">
                                    Ngày {d.day}
                                    {d.title ? `: ${d.title}` : ""}
                                  </p>
                                  {d.summary && <p className="text-xs text-slate-600">{d.summary}</p>}
                                  {d.mealTip && (
                                    <p className="text-xs text-amber-800">🍜 {d.mealTip}</p>
                                  )}
                                  {d.stayTip && <p className="text-xs text-sky-800">🏨 {d.stayTip}</p>}
                                </div>
                              ))}
                            </div>
                            {aiPlan.tips.length > 0 && (
                              <ul className="list-disc pl-5 space-y-1 text-[12px] text-slate-600">
                                {aiPlan.tips.map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            )}
                            <p className="text-[11px] text-slate-400">
                              Nội dung do AI tạo, chỉ mang tính tham khảo. Hãy kiểm tra lại giờ mở cửa và
                              giá trước khi đi.
                            </p>
                          </div>
                        )}

                        {!hasStops ? (
                          <div className={`${cardCls} text-center text-sm text-slate-500`}>
                            Chưa có địa điểm nào để soạn lịch trình. Hãy quay lại bước &quot;Điểm đến&quot;
                            và thêm địa điểm.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                            {/* CÁC NGÀY */}
                            <div className="lg:col-span-7 space-y-7">
                              {schedule.days.map((d) => (
                                <div key={d.day} className={`${cardCls} space-y-2`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="bg-[#204E4A]/90 text-white text-sm font-bold px-4 py-1 rounded-full border border-white/30 shadow-md">
                                      Ngày {d.day}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-600">{d.dateLabel}</span>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Khởi hành {fmtClock(d.startMin)} · {d.startFrom}
                                  </p>

                                  {d.items.length === 0 && (
                                    <p className="text-xs text-slate-500 italic">
                                      Ngày tự do: nghỉ ngơi hoặc tự khám phá thêm.
                                    </p>
                                  )}

                                  {d.items.map((it) => (
                                    <div key={it.place.id} className="space-y-1">
                                      {renderLegs(it.legs)}
                                      <div className="flex items-start gap-3 p-2 rounded-[16px] bg-white border border-slate-200 shadow-sm">
                                        <img
                                          src={it.place.imageUrl}
                                          alt={it.place.name}
                                          referrerPolicy="no-referrer"
                                          className="w-20 h-16 sm:w-24 sm:h-[72px] object-cover rounded-xl bg-slate-200 shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <span className="text-xs font-extrabold text-teal-700 tabular-nums">
                                            {fmtClock(it.start)}
                                          </span>
                                          <p className="font-bold text-sm text-slate-900 leading-snug">{it.place.name}</p>
                                          <p className="text-[11px] text-slate-500">
                                            {fmtDuration(it.end - it.start)} · {fmtClock(it.start)}–
                                            {fmtClock(it.end)} · {it.place.region}
                                          </p>
                                          {aiNoteById[it.place.id] && (
                                            <p className="text-[11px] text-teal-700 font-medium mt-0.5">
                                              ✨ {aiNoteById[it.place.id]}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  {renderLegs(d.eveningLegs)}
                                  {d.foodSuggest && (
                                    <p className="text-[11px] text-amber-700">
                                      🍜 Gợi ý ăn uống: {d.foodSuggest.name} ({d.foodSuggest.region})
                                    </p>
                                  )}
                                  {d.overnightName && (
                                    <p className="text-xs text-slate-600">
                                      🏨 Nghỉ đêm{" "}
                                      {d.overnightPlace && !d.overnightSuggested
                                        ? `tại ${d.overnightPlace.name}`
                                        : `gần ${d.overnightName}`}
                                      {d.overnightPlace && d.overnightSuggested
                                        ? ` (gợi ý: ${d.overnightPlace.name})`
                                        : ""}
                                    </p>
                                  )}
                                  {d.returnLegs.length > 0 && (
                                    <>
                                      {renderLegs(d.returnLegs)}
                                      <p className="text-sm font-bold text-slate-800">
                                        Quay về {originName}
                                      </p>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* TỔNG QUÃNG ĐƯỜNG + CHI PHÍ */}
                            <div className="lg:col-span-5 space-y-7">
                              <div className={`${cardCls} space-y-1`}>
                                <h3 className="text-lg font-bold text-slate-900">Tổng quãng đường</h3>
                                <p className="text-sm text-slate-700">
                                  {schedule.roadKm.toLocaleString("vi-VN")} km đường bộ
                                </p>
                                {schedule.ferryKm > 0 && (
                                  <p className="text-sm text-slate-700">
                                    {schedule.ferryKm.toLocaleString("vi-VN")} km đường thủy
                                  </p>
                                )}
                                <p className="text-xs text-slate-500">
                                  Thời gian di chuyển: {fmtDuration(schedule.driveMin + schedule.ferryMin)}
                                </p>
                              </div>

                              <div className={`${cardCls} space-y-1.5`}>
                                <h3 className="text-lg font-bold text-slate-900">Dự toán chi phí</h3>
                                {(
                                  [
                                    [`Di chuyển (Nhiên liệu ${tripCost.liters.toLocaleString("vi-VN")} lít)`, tripCost.transport],
                                    ...(schedule.ferryCrossings > 0
                                      ? ([[`Tàu/phà ×${schedule.ferryCrossings}`, tripCost.ferry]] as [string, number][])
                                      : []),
                                    ["Ăn uống", tripCost.food],
                                    [`Lưu trú ${tripCost.nights} đêm`, tripCost.lodging],
                                    ["Vé tham quan", tripCost.tickets],
                                    ["Vui chơi và mua sắm", tripCost.fun],
                                    [`Dự phòng ${contingencyPercent}%`, tripCost.contingency],
                                  ] as [string, number][]
                                ).map(([label, value]) => (
                                  <div key={label} className="flex justify-between gap-3 text-sm">
                                    <span className="text-slate-600">{label}</span>
                                    <span className="text-slate-800 tabular-nums shrink-0">
                                      {formatDong(value)}
                                    </span>
                                  </div>
                                ))}
                                <div className="mt-2 px-4 py-3 rounded-2xl bg-[#204E4A] flex justify-between items-baseline">
                                  <span className="font-bold text-white/90">Tổng cộng</span>
                                  <span className="text-lg font-extrabold text-amber-300 tabular-nums">
                                    {formatDong(tripCost.grand)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Mỗi người</span>
                                  <span className="text-slate-800 tabular-nums">
                                    {formatDong(tripCost.perPerson)}
                                  </span>
                                </div>
                                {expectedBudget > 0 && (
                                  <p
                                    className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold ${
                                      tripCost.over
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {tripCost.over
                                      ? `⚠ Vượt ngân sách ${formatDong(Math.abs(tripCost.diff))}`
                                      : `✓ Còn dưới ngân sách ${formatDong(tripCost.diff)}`}
                                  </p>
                                )}
                              </div>

                              <div className={`${cardCls} space-y-2`}>
                                <h3 className="text-lg font-bold text-slate-900">
                                  Cần xác nhận trước khi đi
                                </h3>
                                <ul className="list-disc pl-5 space-y-1 text-[12px] text-slate-600">
                                  {schedule.ferryCrossings > 0 && (
                                    <li>
                                      Lịch tàu và giá vé thay đổi theo mùa, hãy xác nhận tại bến trước khi đi.
                                    </li>
                                  )}
                                  {schedule.warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                  ))}
                                  {selectedPlannerPlaces
                                    .filter((p) => p.behaviorNotes)
                                    .slice(0, 4)
                                    .map((p) => (
                                      <li key={p.id}>
                                        {p.name}: {p.behaviorNotes}
                                      </li>
                                    ))}
                                  <li>Giá vé, giá phòng và chi phí chỉ mang tính tham khảo.</li>
                                </ul>
                              </div>

                              <p className="text-[11px] text-slate-400 px-1">
                                Quãng đường được ước tính từ tọa độ các điểm (đường chim bay × 1,3). Thời
                                gian tính theo tốc độ trung bình của từng loại phương tiện. Giá vé tàu, phà
                                là giá tham khảo.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="trip-no-print">
                          <button type="button" onClick={() => setPlannerStep(3)} className={ghostBtn}>
                            Quay lại
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* DANH SÁCH CÁC CHUYẾN ĐI ĐÃ LƯU */}
              <div className="bg-[#F5F7F8] p-4 sm:p-5 rounded-[18px] shadow-xl ring-8 ring-[#DCE8F0]/90 border border-white/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-teal-600" />
                    <h3 className="text-lg font-bold text-slate-900">
                      Chuyến Đi Đã Lưu ({savedTrips.length})
                    </h3>
                  </div>
                </div>

                {savedTrips.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
                    Bạn chưa lưu chuyến đi nào. Hãy đặt tên chuyến đi và bấm nút{" "}
                    <strong>&quot;Lưu chuyến đi&quot;</strong> ở phía trên để lưu lại lịch trình!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedTrips.map((trip) => {
                      const stopNames = trip.destIds
                        .map((id) => places.find((p) => p.id === id)?.name)
                        .filter(Boolean);

                      return (
                        <div
                          key={trip.id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3 hover:border-teal-400 transition"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-base text-slate-900">{trip.title}</h4>
                              <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold shrink-0">
                                {trip.plannerDays} ngày • {trip.adultCount + trip.childCount} người
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500">
                              🕒 Lưu lúc: {trip.createdAt} • 👤 {trip.owner} • 🚗 {trip.roadKm} km
                              đường bộ
                            </p>

                            <p className="text-xs text-slate-700 line-clamp-2">
                              <strong>Lộ trình ({trip.destIds.length} điểm):</strong>{" "}
                              {stopNames.length > 0
                                ? stopNames.join(" → ")
                                : "Các điểm đến trong lộ trình"}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                            <div className="text-xs">
                              <span className="text-slate-500">Tổng chi phí: </span>
                              <strong className="text-teal-700 text-sm">
                                {trip.totalCost.toLocaleString("vi-VN")} VND
                              </strong>
                              <span className="text-[11px] text-slate-500 block">
                                (~{trip.perPersonCost.toLocaleString("vi-VN")} VND/người)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleLoadSavedTrip(trip)}
                                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer transition shadow-2xs"
                              >
                                Mở lại
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSavedTrip(trip.id)}
                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition"
                                title="Xóa chuyến đi này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              CHẾ ĐỘ 3: CẨM NANG 20 QUY TẮC VĂN MINH DU LỊCH
             ================================================================= */}
          {activeTab === "CAM_NANG" && (
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Bộ 20 Quy Tắc Ứng Xử Văn Minh Du Lịch (Song Ngữ Việt - Anh)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Trích nguyên văn từ ấn phẩm &quot;Sổ tay du lịch An Giang&quot; – NXB Thông Tấn

                  </p>
                </div>
                <button
                  onClick={() => setShowEmergencyModal(true)}
                  className="px-4 py-2 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <PhoneCall className="w-3.5 h-3.5" /> Danh bạ khẩn cấp
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {CIVILIZED_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2"
                  >
                    <div className="space-y-1.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-700 text-white text-xs font-bold">
                        Quy tắc {rule.id}
                      </span>
                      <p className="font-bold text-xs text-slate-900 leading-relaxed">{rule.vi}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 italic border-t border-slate-200 pt-1.5">
                      {rule.en}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              CHẾ ĐỘ 4: ADMIN CMS
             ================================================================= */}
          {activeTab === "ADMIN" && isAdminAuthenticated && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("ocop-admin-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow"
                >
                  <Award className="w-4 h-4" />
                  Tới mục Sản phẩm OCOP ({ocopProducts.length})
                </button>
              </div>
              {/* QUẢN LÝ KHU VỰC */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <h3 className="text-lg font-bold text-slate-900">
                    1. Quản Lý Khu Vực & Tên Hiển Thị Trên Menu / Tab
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tên nút &quot;Tất cả khu vực&quot;
                    </label>
                    <input
                      type="text"
                      value={allRegionLabel}
                      onChange={(e) => setAllRegionLabel(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    />
                  </div>
                  {(
                    [
                      "THAM_QUAN",
                      "AM_THUC",
                      "NHA_NGHI",
                      "MUA_SAM",
                      "LE_HOI",
                      "OCOP",
                      "HANH_TRINH",
                      "CAM_NANG",
                    ] as const
                  ).map((tabKey) => (
                    <div key={tabKey}>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Tên Tab ({tabKey})
                      </label>
                      <input
                        type="text"
                        value={tabLabels[tabKey] || ""}
                        onChange={(e) =>
                          setTabLabels((prev) => ({ ...prev, [tabKey]: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      />
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleSaveRegion}
                  className="flex flex-col sm:flex-row items-end gap-3"
                >
                  <div className="w-full sm:w-64">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên khu vực (VD: Rạch Giá)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên khu vực..."
                      value={newRegionName}
                      onChange={(e) => setNewRegionName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div className="w-full sm:w-72">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên hiển thị menu (VD: rạch giá ^)
                    </label>
                    <input
                      type="text"
                      placeholder="Mặc định giống tên khu vực..."
                      value={newRegionDisplay}
                      onChange={(e) => setNewRegionDisplay(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    {editingRegionId ? "Cập nhật khu vực" : "Thêm khu vực"}
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 pt-1 max-h-40 overflow-y-auto">
                  {regions.map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800"
                    >
                      <span>{reg.name}</span>
                      <span className="text-teal-700 font-normal">
                        (&quot;{reg.displayLabel}&quot;)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRegionId(reg.id);
                          setNewRegionName(reg.name);
                          setNewRegionDisplay(reg.displayLabel);
                        }}
                        className="text-sky-600 hover:text-sky-800 ml-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRegion(reg.id)}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUẢN LÝ ĐỊA ĐIỂM (khi bấm sửa sẽ hiện dạng pop up) */}
              {(() => {
                const placeForm = (
              <form
                onSubmit={handleAdminSavePlace}
                className={
                  editingId
                    ? "bg-white p-4 sm:p-6 rounded-3xl shadow-2xl border border-slate-200 space-y-5 max-w-4xl mx-auto"
                    : "bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white space-y-5"
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-teal-600" />
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingId
                        ? "2. Chỉnh Sửa Địa Điểm, Hình Ảnh & Tag"
                        : "2. Thêm Địa Điểm Mới (Hoặc Nhập Hàng Loạt Từ Excel)"}
                    </h3>
                  </div>

                  {/* NÚT NHẬP DỮ LIỆU TỪ FILE EXCEL (SẼ HỎI LOẠI FILE SAU KHI CHỌN) */}
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      title="Đóng"
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}

                  <label
                    className={`px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs ${
                      editingId ? "hidden" : "flex"
                    } items-center gap-2 cursor-pointer shadow-md transition`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Nhập danh sách từ Excel (.xlsx, .csv)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleSelectExcelFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {imageFetchProgress && (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-1.5">
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        🖼️ Đang tìm ảnh bằng Gemini: {imageFetchProgress.done}/
                        {imageFetchProgress.total} địa điểm
                      </span>
                      <span>Đã gắn ảnh: {imageFetchProgress.found}</span>
                    </div>
                    {imageFetchProgress.note && (
                      <p className="font-normal text-[11px] text-rose-700 break-words">
                        Chưa tìm được ảnh: {imageFetchProgress.note}
                      </p>
                    )}
                    <div className="h-1.5 rounded-full bg-sky-100 overflow-hidden">
                      <div
                        className="h-full bg-sky-600 transition-all"
                        style={{
                          width: `${(imageFetchProgress.done / Math.max(1, imageFetchProgress.total)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên địa điểm *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Đình Thần Nguyễn Trung Trực"
                      value={adminForm.name}
                      onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Khu vực hành chính (Gõ vài chữ đầu để tìm nhanh)
                    </label>
                    <SearchableRegionSelect
                      regions={regions}
                      places={places}
                      value={adminForm.region}
                      onChange={(newReg) => setAdminForm({ ...adminForm, region: newReg })}
                      includeAllOption={false}
                      variant="admin"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mục chức năng (Tab)
                    </label>
                    <select
                      value={adminForm.tab}
                      onChange={(e) =>
                        setAdminForm({ ...adminForm, tab: e.target.value as FunctionalTab })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      <option value="THAM_QUAN">{tabLabels.THAM_QUAN}</option>
                      <option value="AM_THUC">{tabLabels.AM_THUC}</option>
                      <option value="NHA_NGHI">{tabLabels.NHA_NGHI}</option>
                      <option value="MUA_SAM">{tabLabels.MUA_SAM}</option>
                      <option value="LE_HOI">{tabLabels.LE_HOI}</option>
                      <option value="OCOP">🏅 {tabLabels.OCOP || "Sản phẩm OCOP"}</option>
                    </select>
                  </div>
                </div>

                {/* Ô NHẬP GIÁ PHÒNG KHI ADMIN CHỌN TAB NHÀ NGHỈ */}
                {adminForm.tab === "NHA_NGHI" && (
                  <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                    <label className="block text-xs font-bold text-amber-950 mb-1">
                      💰 Giá tiền tham khảo (VD: 200.000 - 350.000 VND/đêm)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 200.000 - 350.000 VND/đêm"
                      value={adminForm.priceLevel}
                      onChange={(e) => setAdminForm({ ...adminForm, priceLevel: e.target.value })}
                      onBlur={(e) =>
                        setAdminForm({ ...adminForm, priceLevel: normalizePriceText(e.target.value) })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 text-sm bg-white"
                    />
                  </div>
                )}

                {/* CHỈ HIỆN Ô NHẬP GIÁ ĐỒ ĂN KHI ADMIN CHỌN TAB ẨM THỰC */}
                {adminForm.tab === "AM_THUC" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        🍴 Khoảng giá món ăn (VD: 35.000 - 55.000 VND/tô)
                      </label>
                      <input
                        type="text"
                        placeholder="VD: 35.000 - 55.000 VND/tô"
                        value={adminForm.priceLevel}
                        onChange={(e) =>
                          setAdminForm({ ...adminForm, priceLevel: e.target.value })
                        }
                        onBlur={(e) =>
                          setAdminForm({ ...adminForm, priceLevel: normalizePriceText(e.target.value) })
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-amber-300 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        💰 Đơn giá trung bình 1 phần (VND - Không bắt buộc)
                      </label>
                      <input
                        type="number"
                        step={5000}
                        placeholder="VD: 45000"
                        value={adminForm.ticketPrice}
                        onChange={(e) =>
                          setAdminForm({ ...adminForm, ticketPrice: Number(e.target.value) })
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-amber-300 text-sm bg-white"
                      />
                      {Number(adminForm.ticketPrice) > 0 && (
                        <p className="mt-1 text-[11px] text-amber-900">
                          = {formatVND(normalizeAmountVND(Number(adminForm.ticketPrice)))}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-950">
                      Nhãn nổi bật góc trái dưới ảnh (VD: Di tích lịch sử 🏛️ / Núi cao 🚠)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Xem trước:</span>
                      <span className="bg-[#204E4A] text-white text-xs font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow">
                        <span>{adminForm.subCategory || "Di tích lịch sử"}</span>
                        <span>{adminForm.badgeIcon || "🏛️"}</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Chữ trên nhãn
                      </label>
                      <input
                        type="text"
                        value={adminForm.subCategory}
                        onChange={(e) =>
                          setAdminForm({ ...adminForm, subCategory: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Chọn nhanh Icon
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="text"
                          value={adminForm.badgeIcon}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, badgeIcon: e.target.value })
                          }
                          className="w-14 text-center py-1.5 rounded-xl border border-slate-300 text-base bg-white"
                        />
                        {PRESET_BADGE_ICONS.map((ico) => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, badgeIcon: ico })}
                            className={`w-8 h-8 rounded-xl border text-base flex items-center justify-center transition ${
                              adminForm.badgeIcon === ico
                                ? "bg-teal-600 text-white border-teal-700 scale-110 shadow"
                                : "bg-white hover:bg-slate-100 border-slate-300"
                            }`}
                          >
                            {ico}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Tải hình ảnh trực tiếp từ máy tính
                    </label>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-teal-500 bg-white hover:bg-teal-50 text-teal-800 font-bold text-xs cursor-pointer transition">
                      <Upload className="w-4 h-4" />
                      <span>Chọn file ảnh từ máy (JPG, PNG, WEBP...)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUploadFromComputer}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="Hoặc dán đường dẫn ảnh (URL)..."
                      value={adminForm.imageUrl}
                      onChange={(e) => setAdminForm({ ...adminForm, imageUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    {adminForm.imageUrl ? (
                      <div className="relative w-44 h-28 rounded-2xl overflow-hidden border border-slate-300 shadow">
                        <img
                          src={adminForm.imageUrl}
                          alt="Xem trước"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1.5 left-1.5 bg-[#204E4A]/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          {adminForm.subCategory} {adminForm.badgeIcon}
                        </span>
                      </div>
                    ) : (
                      <div className="w-44 h-28 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        Chưa chọn ảnh
                      </div>
                    )}
                    <div className="text-xs text-slate-500 space-y-1">
                      <p className="font-bold text-slate-700">Xem trước thẻ ảnh</p>
                      <p>Ảnh tự động nén và đồng bộ vào shared-travel-data.json.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Các thẻ Tag nhỏ bên dưới địa điểm
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập tên tag rồi bấm Thêm tag..."
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTagToForm();
                        }
                      }}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddTagToForm}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
                    >
                      + Thêm Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {adminForm.tags.map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTagFromForm(t)}
                          className="text-rose-600 hover:text-rose-800"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Địa chỉ chính xác *"
                    value={adminForm.address}
                    onChange={(e) => setAdminForm({ ...adminForm, address: e.target.value })}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm md:col-span-2"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Vĩ độ"
                    value={adminForm.latitude}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, latitude: Number(e.target.value) })
                    }
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Kinh độ"
                    value={adminForm.longitude}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, longitude: Number(e.target.value) })
                    }
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                {/* Mở địa chỉ trên Google Maps để đối chiếu vị trí/tọa độ (hiện cả khi thêm mới và khi chỉnh sửa) */}
                <div className="flex flex-wrap items-center gap-2 -mt-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [adminForm.name, adminForm.address].filter(Boolean).join(", ") || "An Giang"
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Mở địa chỉ trên Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {Number(adminForm.latitude) !== 0 && Number(adminForm.longitude) !== 0 && (
                    <a
                      href={`https://www.google.com/maps?q=${adminForm.latitude},${adminForm.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      Xem theo tọa độ
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <textarea
                  rows={2}
                  placeholder="Mô tả chi tiết địa điểm..."
                  value={adminForm.shortDesc}
                  onChange={(e) => setAdminForm({ ...adminForm, shortDesc: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    {editingId ? "Lưu cập nhật địa điểm" : "Thêm địa điểm mới"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </form>
                );
                return editingId
                  ? createPortal(
                      <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm overflow-y-auto p-2 sm:p-6 text-slate-800 font-sans">
                        {placeForm}
                      </div>,
                      document.body
                    )
                  : placeForm;
              })()}

              <div className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-xl border border-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    3. Danh Sách Địa Điểm Theo Từng Địa Bàn ({adminFilteredPlaces.length}/
                    {places.length})
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hideNoImage}
                      onClick={toggleHideNoImage}
                      title="Bật: toàn bộ người dùng sẽ không thấy các địa điểm chưa có ảnh (Admin vẫn thấy)"
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                        hideNoImage
                          ? "bg-[#047857] text-white border-[#047857]"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span aria-hidden>👁️‍🗨️</span>
                      <span>Ẩn nơi chưa có ảnh với người dùng ({missingImageCount})</span>
                      <span
                        className={`w-7 h-4 rounded-full relative transition ${
                          hideNoImage ? "bg-white/40" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${
                            hideNoImage ? "left-3.5" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={adminNoImageOnly}
                      onClick={() => setAdminNoImageOnly((v) => !v)}
                      title="Bật để chỉ hiện các địa điểm chưa có ảnh"
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                        adminNoImageOnly
                          ? "bg-rose-600 text-white border-rose-700"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-rose-50"
                      }`}
                    >
                      <span aria-hidden>🖼️</span>
                      <span>Chưa có ảnh ({missingImageCount})</span>
                      <span
                        className={`w-7 h-4 rounded-full relative transition ${
                          adminNoImageOnly ? "bg-white/40" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${
                            adminNoImageOnly ? "left-3.5" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>
                    {base64ImageCount > 0 && (
                      <button
                        type="button"
                        onClick={migrateBase64Images}
                        disabled={migratingImages}
                        title="Chuyển ảnh cũ dạng base64 sang file trên server để lưu nhẹ và ổn định hơn"
                        className="px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {migratingImages
                          ? "Đang chuyển ảnh..."
                          : `Chuyển ${base64ImageCount} ảnh cũ sang file`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCollapsedRegions([])}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      Mở hết
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollapsedRegions(adminGroups.map((g) => g.region))}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      Thu gọn hết
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Tìm tên / địa chỉ (gõ không dấu cũng được)..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <SearchableRegionSelect
                    regions={regions}
                    places={places}
                    value={adminRegionFilter}
                    onChange={setAdminRegionFilter}
                    includeAllOption={true}
                    allOptionLabel="Tất cả địa bàn"
                    variant="admin"
                  />
                  <select
                    value={adminTabFilter}
                    onChange={(e) => setAdminTabFilter(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 bg-white"
                  >
                    <option value="ALL">Tất cả mục</option>
                    <option value="THAM_QUAN">{tabLabels.THAM_QUAN}</option>
                    <option value="AM_THUC">{tabLabels.AM_THUC}</option>
                    <option value="NHA_NGHI">{tabLabels.NHA_NGHI}</option>
                    <option value="MUA_SAM">{tabLabels.MUA_SAM}</option>
                    <option value="LE_HOI">{tabLabels.LE_HOI}</option>
                    <option value="OCOP">{tabLabels.OCOP || "Sản phẩm OCOP"}</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setAdminRegionFilter("ALL")}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                      adminRegionFilter === "ALL"
                        ? "bg-teal-600 text-white border-teal-700"
                        : "bg-white hover:bg-teal-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    Tất cả ({places.length})
                  </button>
                  {adminRegionChips.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setAdminRegionFilter(c.name)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                        adminRegionFilter === c.name
                          ? "bg-teal-600 text-white border-teal-700"
                          : "bg-white hover:bg-teal-50 text-slate-700 border-slate-300"
                      }`}
                    >
                      {c.name} ({c.count})
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-white overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
                    <tr>
                      <th className="p-4">Ảnh & Nhãn</th>
                      <th className="p-4">Tên địa điểm</th>
                      <th className="p-4">Khu vực</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {adminGroups.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                          {adminNoImageOnly
                            ? "🎉 Không còn địa điểm nào thiếu ảnh trong bộ lọc này."
                            : "Không có địa điểm nào phù hợp với bộ lọc."}
                        </td>
                      </tr>
                    )}
                    {adminGroups.map((group) => (
                      <React.Fragment key={group.region}>
                        <tr className="bg-teal-50/90">
                          <td colSpan={5} className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedRegions((prev) =>
                                  prev.includes(group.region)
                                    ? prev.filter((r) => r !== group.region)
                                    : [...prev, group.region]
                                )
                              }
                              className="w-full flex items-center justify-between text-left font-bold text-teal-900 text-sm"
                            >
                              <span>
                                📍 {group.region}{" "}
                                <span className="font-normal text-slate-500">
                                  ({group.items.length} địa điểm)
                                </span>
                              </span>
                              <span className="text-xs text-teal-700">
                                {collapsedRegions.includes(group.region) ? "Mở ▾" : "Thu gọn ▴"}
                              </span>
                            </button>
                          </td>
                        </tr>
                    {!collapsedRegions.includes(group.region) &&
                      group.items.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            {isMissingImage(p) ? (
                              <>
                              <label
                                title="Chưa có ảnh — bấm để thêm ảnh"
                                className="w-14 h-10 rounded-lg border border-dashed border-rose-300 bg-rose-50 text-rose-500 flex flex-col items-center justify-center text-[9px] font-bold leading-tight cursor-pointer hover:bg-rose-100"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Thêm ảnh</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleQuickImageUpload(p.id, e)}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleQuickImageLink(p.id)}
                                title="Dán link ảnh (VD: ảnh Google Maps)"
                                className="px-1.5 h-10 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 text-[10px] font-bold leading-tight hover:bg-sky-100"
                              >
                                🔗
                                <br />
                                Link
                              </button>
                              </>
                            ) : (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                referrerPolicy="no-referrer"
                                className="w-14 h-10 object-cover rounded-lg border border-slate-200"
                              />
                            )}
                            <span className="bg-[#204E4A] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              {p.subCategory} {p.badgeIcon}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {p.isFeatured && <span title="Địa điểm nổi tiếng">⭐ </span>}
                          {p.name}
                        </td>
                        <td className="p-4">{p.region}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              p.isVisible
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {p.isVisible ? "Hiển thị" : "Đang ẩn"}
                          </span>
                        </td>
                        <td className="p-4 flex items-center gap-2">
                          <button
                            type="button"
                            title={
                              p.isFeatured
                                ? "Bỏ đánh dấu nổi tiếng"
                                : "Đánh dấu nổi tiếng (hiện ở menu chính)"
                            }
                            onClick={() =>
                              setPlaces((prev) =>
                                prev.map((item) =>
                                  item.id === p.id ? { ...item, isFeatured: !item.isFeatured } : item
                                )
                              )
                            }
                            className={`p-1.5 rounded-lg ${
                              p.isFeatured
                                ? "bg-amber-100 text-amber-500 hover:bg-amber-200"
                                : "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500"
                            }`}
                          >
                            <Star
                              className="w-4 h-4"
                              fill={p.isFeatured ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setAdminForm({
                                name: p.name,
                                region: p.region,
                                tab: p.tab,
                                subCategory: p.subCategory,
                                badgeIcon: p.badgeIcon,
                                address: p.address,
                                latitude: p.latitude,
                                longitude: p.longitude,
                                ticketPrice: p.ticketPrice,
                                priceLevel: normalizePriceText(p.priceLevel),
                                openingHours: p.openingHours,
                                phone: p.phone,
                                shortDesc: p.shortDesc,
                                imageUrl: isMissingImage(p) ? "" : p.imageUrl,
                                tags: p.tags,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setPlaces((prev) =>
                                prev.map((item) =>
                                  item.id === p.id
                                    ? { ...item, isVisible: !item.isVisible }
                                    : item
                                )
                              )
                            }
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                          >
                            {p.isVisible ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setPlaces((prev) => prev.filter((item) => item.id !== p.id))
                            }
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* QUẢN LÝ SẢN PHẨM OCOP */}
              <div
                id="ocop-admin-section"
                className="bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-3xl shadow-xl border border-white space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-600" />
                      3. Sản Phẩm OCOP ({ocopProducts.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Thêm / sửa sản phẩm và hình ảnh. Nhập Excel bất kỳ có cột <strong>Tên sản phẩm</strong>
                      (các cột Chủ thể, Nơi cung cấp, Nhóm, Hạng sao, Đôi nét, Hình ảnh là tùy chọn; không có cột
                      hạng sao thì dùng hạng đang chọn trong form). Du khách xem ở tab{" "}
                      <strong>{tabLabels.OCOP || "Sản phẩm OCOP"}</strong> trên menu.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Nhập sản phẩm OCOP từ Excel (.xlsx, .csv)
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleOcopImportExcel}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSeedOcopSamples}
                      className="px-4 py-2 rounded-xl bg-white border border-emerald-700 text-emerald-800 hover:bg-emerald-50 font-bold text-xs flex items-center gap-2"
                    >
                      Nạp 20 sản phẩm mẫu (5 & 4 sao)
                    </button>
                  </div>
                </div>

                <form
                  id="ocop-admin-form"
                  onSubmit={handleOcopSave}
                  className="space-y-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-950">
                      {ocopEditingId ? "✏️ Đang sửa sản phẩm" : "➕ Thêm sản phẩm OCOP mới"}
                    </span>
                    {ocopEditingId && (
                      <button
                        type="button"
                        onClick={resetOcopForm}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <X className="w-4 h-4" /> Hủy sửa
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tên sản phẩm *</label>
                      <input
                        type="text"
                        required
                        value={ocopForm.name}
                        onChange={(e) => setOcopForm({ ...ocopForm, name: e.target.value })}
                        placeholder="VD: Mật thốt nốt Palmania"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nhóm sản phẩm</label>
                      <input
                        type="text"
                        list="ocop-group-list"
                        value={ocopForm.group}
                        onChange={(e) => setOcopForm({ ...ocopForm, group: e.target.value })}
                        placeholder="VD: Nước mắm Phú Quốc"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      />
                      <datalist id="ocop-group-list">
                        {Array.from(
                          new Set([...OCOP_GROUP_SUGGESTIONS, ...ocopProducts.map((p) => p.subCategory)])
                        ).map((g) => (
                          <option key={g} value={g} />
                        ))}
                      </datalist>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chủ thể sản phẩm</label>
                      <input
                        type="text"
                        value={ocopForm.owner}
                        onChange={(e) => setOcopForm({ ...ocopForm, owner: e.target.value })}
                        placeholder="VD: Công ty Cổ phần Palmania"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Hạng sao OCOP</label>
                      <select
                        value={ocopForm.stars}
                        onChange={(e) => setOcopForm({ ...ocopForm, stars: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        <option value={5}>⭐ 5 sao</option>
                        <option value={4}>4 sao</option>
                        <option value={3}>3 sao</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Khu vực</label>
                      <select
                        value={ocopForm.region || regions[0]?.name || ""}
                        onChange={(e) => setOcopForm({ ...ocopForm, region: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {regions.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nơi cung cấp (Xã / Phường / Đặc khu)
                      </label>
                      <input
                        type="text"
                        value={ocopForm.address}
                        onChange={(e) => setOcopForm({ ...ocopForm, address: e.target.value })}
                        placeholder="VD: Xã Tri Tôn (trước đây là TT. Tri Tôn, H. Tri Tôn)"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Đôi nét về sản phẩm</label>
                      <textarea
                        rows={3}
                        value={ocopForm.desc}
                        onChange={(e) => setOcopForm({ ...ocopForm, desc: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <div className="w-full sm:w-40 h-28 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center text-xs text-slate-500">
                      {ocopForm.imageUrl ? (
                        <img
                          src={ocopForm.imageUrl}
                          alt="Xem trước"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        "Chưa có ảnh"
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Hình ảnh sản phẩm</label>
                      <div className="flex flex-wrap gap-2">
                        <label className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow">
                          <Upload className="w-4 h-4" />
                          {ocopUploading ? "Đang tải ảnh..." : "Tải ảnh từ máy"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleOcopImageUpload}
                            disabled={ocopUploading}
                            className="hidden"
                          />
                        </label>
                        {ocopForm.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setOcopForm({ ...ocopForm, imageUrl: "" })}
                            className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={ocopForm.imageUrl}
                        onChange={(e) => setOcopForm({ ...ocopForm, imageUrl: e.target.value })}
                        placeholder="Hoặc dán link ảnh (https://...)"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={ocopUploading}
                      className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      {ocopEditingId ? "Lưu thay đổi" : "Thêm sản phẩm"}
                    </button>
                  </div>
                </form>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={ocopSearch}
                    onChange={(e) => setOcopSearch(e.target.value)}
                    placeholder="Tìm sản phẩm OCOP..."
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                {ocopVisibleList.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Chưa có sản phẩm OCOP. Bấm &quot;Nạp 20 sản phẩm OCOP&quot; hoặc thêm mới ở trên.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {ocopVisibleList.map((p) => {
                      const info = parseOcopInfo(p.culturalHistory);
                      return (
                        <div
                          key={p.id}
                          className={`flex gap-3 p-3 rounded-2xl border bg-white ${
                            p.isVisible ? "border-slate-200" : "border-slate-200 opacity-60"
                          }`}
                        >
                          <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-200 shrink-0 relative">
                            {isMissingImage(p) ? (
                              <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-rose-600 text-center px-1">
                                Chưa có ảnh
                              </div>
                            ) : (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-bold text-sm text-slate-900 line-clamp-2">{p.name}</p>
                            <p className="text-[11px] text-slate-600 truncate">
                              {p.subCategory} • {info.owner || "—"}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              📍 {p.region} • {info.stars} sao
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <select
                                value={info.stars}
                                onChange={(e) => handleOcopSetStars(p.id, Number(e.target.value))}
                                title="Đổi hạng sao OCOP (đánh giá lại)"
                                className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${
                                  info.stars === 5
                                    ? "bg-amber-50 border-amber-300 text-amber-800"
                                    : "bg-white border-slate-300 text-slate-700"
                                }`}
                              >
                                <option value={5}>⭐ 5 sao</option>
                                <option value={4}>4 sao</option>
                                <option value={3}>3 sao</option>
                              </select>
                              <label className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                                <Upload className="w-3.5 h-3.5" />
                                {isMissingImage(p) ? "Thêm ảnh" : "Đổi ảnh"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleQuickImageUpload(p.id, e)}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleOcopEdit(p)}
                                className="p-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"
                                title="Sửa"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPlaces((prev) =>
                                    prev.map((item) =>
                                      item.id === p.id ? { ...item, isVisible: !item.isVisible } : item
                                    )
                                  )
                                }
                                className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                                title={p.isVisible ? "Ẩn khỏi du khách" : "Hiện cho du khách"}
                              >
                                {p.isVisible ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Xóa sản phẩm "${p.name}"?`)) {
                                    setPlaces((prev) => prev.filter((item) => item.id !== p.id));
                                    if (ocopEditingId === p.id) resetOcopForm();
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* QUẢN LÝ BẾN TÀU / BẾN XE / SÂN BAY TRÊN BẢN ĐỒ */}
              <div className="bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-3xl shadow-xl border border-white space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Bến Tàu • Bến Xe • Sân Bay Trên Bản Đồ ({transitHubs.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Nhập bằng nút &quot;Nhập danh sách từ Excel&quot; ở mục 2, chọn loại{" "}
                      <strong>bến tàu / bến xe / sân bay</strong>.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadHubTemplate}
                      className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                    >
                      ⬇ Tải file Excel mẫu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Đặt lại danh sách về 12 điểm mặc định? Các điểm đã nhập từ Excel sẽ bị xóa.")) {
                          setTransitHubs(DEFAULT_TRANSIT_HUBS);
                        }
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                    >
                      Khôi phục mặc định
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                  {transitHubs.map((h) => (
                    <div key={h.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {HUB_META[h.type].symbol} {h.name}
                        <span className="ml-2 font-normal text-slate-500">
                          {HUB_META[h.type].label} • {h.lat}, {h.lng}
                        </span>
                      </span>
                      <button
                        type="button"
                        title="Xóa điểm này"
                        onClick={() => setTransitHubs((prev) => prev.filter((x) => x.id !== h.id))}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* DỌN DỮ LIỆU: ĐỊA ĐIỂM NGOÀI 102 XÃ / PHƯỜNG / ĐẶC KHU */}
              <div className="bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-3xl shadow-xl border border-white space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    4. Dọn Dữ Liệu: Địa Điểm Ngoài 102 Xã / Phường / Đặc Khu Của An Giang
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hệ thống so khu vực của từng địa điểm với danh sách 102 đơn vị hành chính (không
                    phân biệt dấu, bỏ tiền tố &quot;Xã&quot;, &quot;Phường&quot;, &quot;Đặc
                    khu&quot;). Bạn sẽ xem danh sách trước, chưa xóa gì cho đến khi bấm xác nhận.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePreviewCleanup}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold"
                >
                  Kiểm tra địa điểm ngoài danh sách
                </button>

                {cleanupPreview && (
                  <div className="space-y-3">
                    {cleanupPreview.length === 0 ? (
                      <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-semibold">
                        ✓ Cả {places.length} địa điểm đều thuộc 102 xã/phường/đặc khu. Không có gì để
                        xóa.
                      </p>
                    ) : (
                      <>
                        <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-900 font-semibold">
                          Tìm thấy {cleanupPreview.length}/{places.length} địa điểm có khu vực nằm
                          ngoài danh sách:
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(
                            cleanupPreview.reduce<Record<string, number>>((acc, p) => {
                              acc[p.region || "(trống)"] = (acc[p.region || "(trống)"] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([region, count]) => (
                            <span
                              key={region}
                              className="px-3 py-1 rounded-full bg-rose-100 text-rose-900 text-xs font-bold"
                            >
                              {region} ({count})
                            </span>
                          ))}
                        </div>

                        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                          {cleanupPreview.map((p) => (
                            <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              <span className="text-slate-500 shrink-0">
                                {p.region || "(trống)"} • {tabLabels[p.tab] || p.tab}
                              </span>
                            </div>
                          ))}
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cleanupRemoveRegions}
                            onChange={(e) => setCleanupRemoveRegions(e.target.checked)}
                            className="w-4 h-4 accent-teal-600"
                          />
                          <span>
                            Xóa luôn các khu vực không thuộc danh sách 102 khỏi phần &quot;Quản Lý
                            Khu Vực&quot;
                          </span>
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadCleanupBackup}
                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                          >
                            ⬇ Tải sao lưu (JSON) trước khi xóa
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmCleanup}
                            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                          >
                            Xóa {cleanupPreview.length} địa điểm này
                          </button>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setCleanupPreview(null)}
                      className="text-xs font-semibold text-slate-500 hover:underline"
                    >
                      Đóng danh sách
                    </button>
                  </div>
                )}
              </div>

              {/* SAO LƯU & KHÔI PHỤC DỮ LIỆU */}
              <div className="bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-3xl shadow-xl border border-white space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">5. Sao Lưu & Khôi Phục Dữ Liệu</h3>
                  <p className="text-xs text-slate-500">
                    Hệ thống tự sao lưu 1 bản phụ vào thư mục <strong>backups</strong> khi mở web, khi
                    tắt web, mỗi 10 phút và khi bật/tắt máy chủ (giữ tối đa 30 bản mới nhất). Dữ
                    liệu rỗng sẽ không bao giờ được ghi đè lên bản sao lưu.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={backupBusy}
                    onClick={handleBackupNow}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    Sao lưu ngay
                  </button>
                  <button
                    type="button"
                    disabled={backupBusy}
                    onClick={loadBackupList}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700"
                  >
                    {backupList ? "Làm mới danh sách" : "Xem các bản sao lưu"}
                  </button>
                </div>

                {backupNotice && (
                  <p className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 font-semibold break-all">
                    {backupNotice}
                  </p>
                )}

                {backupList &&
                  (backupList.length === 0 ? (
                    <p className="p-4 text-center rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
                      Chưa có bản sao lưu nào.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                      {backupList.map((b) => (
                        <div
                          key={b.name}
                          className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900">
                              {new Date(b.createdAt).toLocaleString("vi-VN")}
                              <span className="ml-2 font-semibold text-teal-700">
                                {BACKUP_REASON_LABELS[b.reason] || b.reason}
                              </span>
                            </p>
                            <p className="text-slate-500">
                              {b.places.toLocaleString("vi-VN")} địa điểm •{" "}
                              {(b.size / 1024 / 1024 >= 1
                                ? `${(b.size / 1024 / 1024).toFixed(1)} MB`
                                : `${Math.max(1, Math.round(b.size / 1024))} KB`)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`/api/backup?download=${encodeURIComponent(b.name)}`}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-700"
                            >
                              ⬇ Tải về
                            </a>
                            <button
                              type="button"
                              disabled={backupBusy}
                              onClick={() => handleRestoreBackup(b.name)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold"
                            >
                              Khôi phục
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =====================================================================
          MODAL HỎI LOẠI FILE EXCEL TRƯỚC KHI NHẬP
         ===================================================================== */}
      {pendingExcelFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">File Excel này thuộc loại nào?</h3>
                <p className="text-xs text-slate-500 break-all">📄 {pendingExcelFile.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingExcelFile(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {IMPORT_TAB_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setImportTab(opt.id)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-left text-sm font-bold flex items-center gap-3 transition ${
                    importTab === opt.id
                      ? "bg-teal-600 text-white border-teal-700 shadow"
                      : "bg-white hover:bg-teal-50 text-slate-800 border-slate-300"
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span>File về {opt.label.toLowerCase()}</span>
                  {importTab === opt.id && <Check className="w-4 h-4 ml-auto" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setImportTab("HUB")}
                className={`w-full px-4 py-2.5 rounded-xl border text-left text-sm font-bold flex items-center gap-3 transition ${
                  importTab === "HUB"
                    ? "bg-teal-600 text-white border-teal-700 shadow"
                    : "bg-white hover:bg-teal-50 text-slate-800 border-slate-300"
                }`}
              >
                <span className="text-lg">⚓</span>
                <span>File về bến tàu / bến xe / sân bay (hiện trên bản đồ)</span>
                {importTab === "HUB" && <Check className="w-4 h-4 ml-auto" />}
              </button>
            </div>

            <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              {importTab === "HUB"
                ? "Cột cần có: Tên, Loại (Bến tàu / Bến xe / Sân bay — bỏ trống thì tự nhận từ tên), Tọa Độ (VD: 10.0145, 105.0752) hoặc 2 cột Vĩ độ + Kinh độ. Cột Ghi chú, Địa chỉ không bắt buộc."
                : importTab === "AM_THUC"
                ? "Cột cần có: Tên Địa Điểm, Địa chỉ, Khu vực, Đánh giá, Số đánh giá, Đánh Giá Nổi Bật, Tọa Độ + Giá Tiền của quán (hệ thống tính giá trung bình)."
                : importTab === "THAM_QUAN"
                ? "Cột cần có: Tên Địa Điểm, Địa chỉ, Khu vực, Đánh giá, Số đánh giá, Đánh Giá Nổi Bật, Tọa Độ + Mô tả về địa điểm tham quan."
                : "Cột cần có: Tên Địa Điểm, Địa chỉ, Khu vực, Đánh giá, Số đánh giá, Đánh Giá Nổi Bật, Tọa Độ. Không cần cột nào thêm."}
            </p>

            <label
              className={`${
                importTab === "HUB" ? "hidden" : "flex"
              } items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-slate-800 cursor-pointer`}
            >
              <input
                type="checkbox"
                checked={autoFindImages}
                onChange={(e) => setAutoFindImages(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-teal-600 cursor-pointer"
              />
              <span>
                <strong>Tự động tìm ảnh bằng Gemini</strong>
                <span className="block text-slate-500">
                  Sau khi nhập, hệ thống tìm ảnh cho từng địa điểm và gắn vào thẻ. Địa điểm nào
                  không tìm được sẽ dùng ảnh mặc định.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingExcelFile(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmImportExcel}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold"
              >
                Nhập vào mục này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL ĐƯỜNG DÂY NÓNG KHẨN CẤP (EMERGENCY HOTLINES)
         ===================================================================== */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-rose-700 to-amber-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-5 h-5 text-amber-200" />
                <div>
                  <h3 className="font-bold text-lg">Đường Dây Nóng & Hỗ Trợ Khẩn Cấp</h3>
                  <p className="text-xs text-white/80">
                    Trích từ Sổ tay Du lịch An Giang (NXB Thông Tấn)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
              {EMERGENCY_HOTLINES.map((g, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">{g.group}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.items.map((item, i) => (
                      <a
                        key={i}
                        href={`tel:${item.phone.replace(/[^0-9]/g, "")}`}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 block">{item.title}</span>
                          <span className="text-teal-700 font-bold">{item.phone}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                          Gọi
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          THANH ĐIỀU HƯỚNG DƯỚI + MENU "THÊM" (CHỈ HIỆN TRÊN ĐIỆN THOẠI)
         ===================================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {(
          [
            { id: "THAM_QUAN", label: tabLabels.THAM_QUAN || "Tham quan", icon: BookOpen },
            { id: "BAN_DO", label: tabLabels.BAN_DO || "Bản đồ", icon: Map },
            { id: "AM_THUC", label: tabLabels.AM_THUC || "Ẩm thực", icon: Utensils },
            { id: "HANH_TRINH", label: tabLabels.HANH_TRINH || "Hành trình", icon: Calendar },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setShowMobileMore(false);
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition ${
                active ? "text-teal-700" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{item.label}</span>
              {item.id === "HANH_TRINH" && plannerDestIds.length > 0 && (
                <span className="absolute top-1 right-3 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center">
                  {plannerDestIds.length}
                </span>
              )}
              {active && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-teal-600" />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowMobileMore((prev) => !prev)}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition ${
            showMobileMore ||
            ["NHA_NGHI", "MUA_SAM", "LE_HOI", "OCOP", "CAM_NANG", "ADMIN"].includes(activeTab)
              ? "text-teal-700"
              : "text-slate-500"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>Thêm</span>
        </button>
      </nav>

      {showMobileMore && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end"
          onClick={() => setShowMobileMore(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-4 pb-8 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Thêm chức năng</h3>
              <button
                type="button"
                onClick={() => setShowMobileMore(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: "NHA_NGHI", label: tabLabels.NHA_NGHI || "Nhà nghỉ", icon: Bed },
                  { id: "MUA_SAM", label: tabLabels.MUA_SAM || "Mua sắm", icon: ShoppingBag },
                  { id: "LE_HOI", label: tabLabels.LE_HOI || "Lễ hội", icon: Sparkles },
                  { id: "OCOP", label: tabLabels.OCOP || "Sản phẩm OCOP", icon: Award },
                  { id: "CAM_NANG", label: tabLabels.CAM_NANG || "Cẩm nang", icon: ShieldCheck },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setShowMobileMore(false);
                    }}
                    className={`py-3 px-3.5 rounded-2xl border text-sm font-bold flex items-center gap-2.5 ${
                      active
                        ? "bg-teal-600 text-white border-teal-700"
                        : "bg-slate-50 text-slate-800 border-slate-200"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              {isAdminAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("ADMIN");
                    setShowMobileMore(false);
                  }}
                  className="py-3 px-3.5 rounded-2xl bg-slate-900 text-amber-300 text-sm font-bold flex items-center gap-2.5"
                >
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span>Admin CMS</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMobileMore(false);
                  setShowEmergencyModal(true);
                }}
                className="py-3 px-3.5 rounded-2xl bg-rose-600 text-white text-sm font-bold flex items-center gap-2.5"
              >
                <PhoneCall className="w-5 h-5 shrink-0" />
                <span>Hotline khẩn cấp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setUserLocation({
                        lat: Number(pos.coords.latitude.toFixed(4)),
                        lng: Number(pos.coords.longitude.toFixed(4)),
                        label: "GPS hiện tại của bạn",
                      });
                    });
                  }
                  setShowMobileMore(false);
                }}
                className="py-3 px-3.5 rounded-2xl bg-sky-50 text-sky-900 border border-sky-200 text-sm font-bold flex items-center gap-2.5"
              >
                <Navigation className="w-5 h-5 shrink-0" />
                <span>Cập nhật GPS</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="truncate">Vị trí hiện tại: {userLocation.label}</span>
            </p>
          </div>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Đăng Nhập Hệ Thống</h3>
                  <p className="text-xs text-slate-500">
                    Nhập admin / admin để mở quyền Quản trị viên
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-1">
              <input
                type="text"
                required
                placeholder="Tên tài khoản hoặc Email"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="password"
                required
                placeholder="Mật khẩu"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              {loginError && (
                <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md"
              >
                Đăng Nhập
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐĂNG KÝ */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Đăng Ký Tài Khoản Du Khách</h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Tên tài khoản / Họ tên"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Địa chỉ Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="password"
                required
                placeholder="Mật khẩu"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              {regError && (
                <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {regError}
                </p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md"
              >
                Tạo Tài Khoản & Đăng Nhập
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT ĐỊA ĐIỂM KÈM BÌNH LUẬN & QUY TẮC ỨNG XỬ */}
      {selectedPlace && (
        <div
          key={selectedPlace.id}
          className="fixed inset-x-0 bottom-0 top-[58px] md:top-0 md:left-[235px] z-30 overflow-y-auto bg-gradient-to-b from-sky-100 via-white to-teal-50 text-slate-800 font-sans pb-24 md:pb-8"
        >
          <div className="max-w-5xl mx-auto w-full bg-white/95 sm:rounded-3xl shadow-xl space-y-5 p-4 sm:p-6 sm:mt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase text-teal-700">
                  {selectedPlace.region} • {selectedPlace.subCategory} {selectedPlace.badgeIcon}
                  {selectedPlace.pageSource ? ` • Sổ tay Trang ${selectedPlace.pageSource}` : ""}
                </span>
                <h3 className="text-2xl font-bold text-slate-900">{selectedPlace.name}</h3>
                {selectedPlace.englishName && (
                  <p className="text-xs text-slate-500 italic">{selectedPlace.englishName}</p>
                )}
                <p className="text-xs text-amber-600 font-bold">
                  ★ {normalizeRating(selectedPlace.rating)}/5 (
                  {selectedPlace.reviewCount.toLocaleString("vi-VN")} đánh giá)
                </p>
              </div>
              <button
                onClick={closePlace}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold shrink-0"
              >
                ← Quay lại
              </button>
            </div>

            <img
              src={selectedPlace.imageUrl}
              alt={selectedPlace.name}
              referrerPolicy="no-referrer"
              className="w-full h-56 sm:h-80 object-cover rounded-2xl"
            />

            {selectedPlace.awardBadge && (
              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-xl border border-amber-200">
                <Award className="w-4 h-4 text-amber-600" />
                <span>{selectedPlace.awardBadge}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {/* GIÁ PHÒNG THAM KHẢO KHI THUỘC TAB NHÀ NGHỈ */}
              {selectedPlace.tab === "NHA_NGHI" && (
                <p className="flex items-center gap-1.5 sm:col-span-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-950">
                  <span>💰</span>
                  <span>
                    <strong>Giá tiền tham khảo:</strong>{" "}
                    <span className="font-extrabold text-amber-800">
                      {getStayPriceText(selectedPlace)}
                    </span>
                  </span>
                </p>
              )}

              {/* CHỈ HIỂN THỊ GIÁ MÓN ĂN KHI THUỘC TAB ẨM THỰC */}
              {selectedPlace.tab === "AM_THUC" && (
                <p className="flex items-center gap-1.5 sm:col-span-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-950">
                  <span>🍴</span>
                  <span>
                    <strong>Giá món ăn tham khảo:</strong>{" "}
                    <span className="font-extrabold text-amber-800">
                      {getFoodPriceText(selectedPlace)}
                    </span>
                  </span>
                </p>
              )}

              <p className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  <strong>Địa chỉ:</strong> {selectedPlace.address}
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  <strong>Khoảng cách:</strong> {formatApproxKm(selectedPlace.distanceKm)} (~
                  {selectedPlace.durationMinutes} phút xe)
                </span>
              </p>
              {selectedPlace.tab !== "OCOP" && (
                <p className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    <strong>Giờ mở cửa:</strong> {selectedPlace.openingHours}
                  </span>
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  <strong>Liên hệ:</strong> {selectedPlace.phone}
                </span>
              </p>
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              {selectedPlace.shortDesc && (
                <p>
                  <strong>Giới thiệu:</strong> {selectedPlace.shortDesc}
                </p>
              )}
              {selectedPlace.culturalHistory && (
                <p className={selectedPlace.tab === "OCOP" ? "whitespace-pre-line" : undefined}>
                  <strong>
                    {selectedPlace.tab === "OCOP"
                      ? "Thông tin công nhận OCOP:"
                      : "Câu chuyện & Giá trị văn hóa:"}
                  </strong>{" "}
                  {selectedPlace.tab === "OCOP" ? <br /> : null}
                  {selectedPlace.culturalHistory}
                </p>
              )}
              {selectedPlace.behaviorNotes && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900">
                  <strong>💡 Lưu ý ứng xử văn minh:</strong> {selectedPlace.behaviorNotes}
                </div>
              )}
            </div>

            {/* Khu vực Đánh giá & Nhận xét của du khách */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <MessageSquarePlus className="w-4 h-4 text-teal-600" />
                <span>Đánh giá & Nhận xét thực tế từ du khách</span>
              </h4>

              <form onSubmit={handleAddReview} className="flex flex-col sm:flex-row gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Tên của bạn"
                  value={reviewAuthor}
                  onChange={(e) => setReviewAuthor(e.target.value)}
                  className="sm:w-36 px-3 py-2 rounded-xl border border-slate-300"
                />
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="px-2.5 py-2 rounded-xl border border-slate-300 font-bold text-amber-600"
                >
                  <option value={5}>5 ★ Tuyệt vời</option>
                  <option value={4}>4 ★ Rất tốt</option>
                  <option value={3}>3 ★ Khá</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Chia sẻ trải nghiệm hoặc mẹo tham quan..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold shrink-0"
                >
                  Gửi
                </button>
              </form>

              <div className="space-y-2 max-h-36 overflow-y-auto">
                {reviews
                  .filter((r) => r.placeId === selectedPlace.id)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{r.authorName}</span>
                        <span className="text-amber-500 font-bold ml-2">{"★".repeat(r.rating)}</span>
                        <p className="text-slate-600 mt-0.5">{r.comment}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{r.createdAt}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPlannerDestIds((prev) =>
                    prev.includes(selectedPlace.id)
                      ? prev.filter((id) => id !== selectedPlace.id)
                      : [...prev, selectedPlace.id]
                  );
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                {plannerDestIds.includes(selectedPlace.id)
                  ? "✓ Đã có trong hành trình"
                  : "+ Thêm vào hành trình"}
              </button>
              <a
                href={buildGoogleMapsSearchUrl(selectedPlace)}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                Mở trên Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {nearbyData && (
              <>
                {renderNearbySection(
                  "Khu vực & điểm tham quan gần đây",
                  "📍",
                  nearbyData.sights,
                  "Chưa có điểm tham quan nào khác ở gần."
                )}
                {renderNearbySection(
                  "Quán ăn gần đây",
                  "🍜",
                  nearbyData.food,
                  "Chưa có quán ăn nào ở gần."
                )}
                {renderNearbySection(
                  "Nhà nghỉ gần đây",
                  "🏨",
                  nearbyData.stay,
                  "Chưa có nhà nghỉ nào ở gần."
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
