import { cookies } from "next/headers";
import { constantTimeEquals } from "@/lib/human";

const cookieName = "altbook_admin";

export function isAdminTokenValid(token: string | null | undefined) {
  const configured = process.env.ADMIN_TOKEN;

  if (!configured || !token) {
    return false;
  }

  return constantTimeEquals(token, configured);
}

export function getAdminSession() {
  return isAdminTokenValid(cookies().get(cookieName)?.value);
}

export function setAdminSession(token: string) {
  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearAdminSession() {
  cookies().delete(cookieName);
}
