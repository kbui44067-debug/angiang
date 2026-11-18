// Chạy 1 lần khi máy chủ Next.js khởi động: sao lưu dữ liệu ngay lúc bật,
// và cố gắng sao lưu thêm 1 bản khi máy chủ tắt.
import { createBackup } from "./lib/backup";

const g = globalThis as unknown as { __agBackupHooked?: boolean };

if (!g.__agBackupHooked) {
  g.__agBackupHooked = true;

  try {
    createBackup("startup");
  } catch {}

  let shutdownDone = false;
  const backupOnShutdown = () => {
    if (shutdownDone) return;
    shutdownDone = true;
    try {
      createBackup("shutdown");
    } catch {}
  };

  // Tắt bình thường (chỉ chạy được code đồng bộ)
  process.on("exit", backupOnShutdown);

  // Tắt bằng Ctrl+C hoặc lệnh kill
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      backupOnShutdown();
      process.exit(0);
    });
  }
}