// Chạy 1 lần khi máy chủ Next.js khởi động.
// Chỉ nạp phần sao lưu khi đang chạy trên Node.js (Edge Runtime không có process.on).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}