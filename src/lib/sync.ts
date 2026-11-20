// Dùng chung cho CẢ server (app/api/state/route.ts) và client (page.tsx).
// Ý tưởng: thay vì gửi toàn bộ dữ liệu, client chỉ gửi "phần mình đã thay đổi" (delta).
// Server áp delta lên file hiện tại => hai người sửa 2 địa điểm khác nhau sẽ không đè nhau.

export interface Delta<T> {
  upsert: T[]; // thêm mới hoặc sửa (theo khóa id / username)
  remove: string[]; // khóa của các mục bị xóa
}

export interface SharedState {
  version?: number;
  places: any[];
  regions: any[];
  users: any[];
  reviews: any[];
  savedTrips: any[];
  transitHubs: any[];
  allRegionLabel?: string;
  tabLabels?: Record<string, string>;
}

export interface StateDelta {
  places?: Delta<any>;
  regions?: Delta<any>;
  users?: Delta<any>;
  reviews?: Delta<any>;
  savedTrips?: Delta<any>;
  transitHubs?: Delta<any>;
  allRegionLabel?: string;
  tabLabels?: Record<string, string>; // chỉ các nhãn bị đổi
}

const COLLECTIONS = ["places", "regions", "users", "reviews", "savedTrips", "transitHubs"] as const;
type CollectionName = (typeof COLLECTIONS)[number];

// users dùng username làm khóa, còn lại dùng id
const keyOf = (name: CollectionName, x: any): string =>
  String(name === "users" ? x?.username : x?.id);

function diffCollection(name: CollectionName, base: any[], cur: any[]): Delta<any> | null {
  const baseMap = new Map<string, string>();
  for (const b of base) baseMap.set(keyOf(name, b), JSON.stringify(b));

  const upsert: any[] = [];
  const seen = new Set<string>();
  for (const c of cur) {
    const k = keyOf(name, c);
    seen.add(k);
    if (baseMap.get(k) !== JSON.stringify(c)) upsert.push(c);
  }
  const remove: string[] = [];
  for (const k of baseMap.keys()) if (!seen.has(k)) remove.push(k);

  return upsert.length || remove.length ? { upsert, remove } : null;
}

function applyCollection(name: CollectionName, target: any[], delta?: Delta<any>): any[] {
  if (!delta) return target;
  const removeSet = new Set((delta.remove || []).map(String));
  const out = target.filter((t) => !removeSet.has(keyOf(name, t)));
  const index = new Map<string, number>();
  out.forEach((t, i) => index.set(keyOf(name, t), i));
  for (const u of delta.upsert || []) {
    const k = keyOf(name, u);
    const i = index.get(k);
    if (i === undefined) {
      index.set(k, out.length);
      out.push(u);
    } else {
      out[i] = u;
    }
  }
  return out;
}

/** So sánh 2 trạng thái, trả về phần thay đổi (hoặc null nếu giống nhau). */
export function diffState(base: SharedState, cur: SharedState): StateDelta | null {
  const delta: StateDelta = {};
  let changed = false;

  for (const name of COLLECTIONS) {
    const d = diffCollection(name, base[name] || [], cur[name] || []);
    if (d) {
      delta[name] = d;
      changed = true;
    }
  }
  if (cur.allRegionLabel !== undefined && cur.allRegionLabel !== base.allRegionLabel) {
    delta.allRegionLabel = cur.allRegionLabel;
    changed = true;
  }
  const labelPatch: Record<string, string> = {};
  for (const [k, v] of Object.entries(cur.tabLabels || {})) {
    if ((base.tabLabels || {})[k] !== v) labelPatch[k] = v;
  }
  if (Object.keys(labelPatch).length) {
    delta.tabLabels = labelPatch;
    changed = true;
  }
  return changed ? delta : null;
}

/** Áp delta lên một trạng thái (trả về bản mới, không sửa bản gốc). */
export function applyStateDelta(state: SharedState, delta: StateDelta): SharedState {
  const next: SharedState = { ...state };
  for (const name of COLLECTIONS) {
    next[name] = applyCollection(name, state[name] || [], delta[name]);
  }
  if (typeof delta.allRegionLabel === "string") next.allRegionLabel = delta.allRegionLabel;
  if (delta.tabLabels && typeof delta.tabLabels === "object") {
    next.tabLabels = { ...(state.tabLabels || {}), ...delta.tabLabels };
  }
  return next;
}