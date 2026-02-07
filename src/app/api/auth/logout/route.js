import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(request) {
  const cookieHeader = request.cookies.get("refreshToken");
  const token = cookieHeader?.value;

  if (token) {
    const db = await getDb();
    await db.collection("refresh_tokens").deleteOne({ token });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
