import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId: string;
  email: string;
  role: "USER" | "EDITOR" | "ADMIN";
}

export function verifyBackendRole(
  req: NextRequest,
  allowedRoles: Array<"ADMIN" | "EDITOR" | "USER">
): { authorized: boolean; user?: AuthPayload; response?: NextResponse } {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Chưa đăng nhập hoặc thiếu token xác thực." },
        { status: 401 }
      ),
    };
  }

  try {
    const secret = process.env.JWT_SECRET || "dev-fallback-secret-change-in-prod";
    const decoded = jwt.verify(token, secret) as AuthPayload;

    if (!allowedRoles.includes(decoded.role)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Bạn không có quyền truy cập chức năng quản trị này." },
          { status: 403 }
        ),
      };
    }

    return { authorized: true, user: decoded };
  } catch {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      ),
    };
  }
}