import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();

    const [routes, folders, totalUsers] = await Promise.all([
      db.collection("routes")
        .find({ status: "published" })
        .project({ _id: 1, adminOnly: 1, folderIds: 1, folderId: 1, distance: 1 })
        .toArray(),
      db.collection("folders").find({}).toArray(),
      db.collection("users").countDocuments(),
    ]);

    const folderMap = {};
    for (const f of folders) folderMap[f._id.toString()] = f;

    const visible = routes.filter((r) => {
      if (r.adminOnly) return false;
      const fids = Array.isArray(r.folderIds)
        ? r.folderIds.map(String)
        : r.folderId ? [String(r.folderId)] : [];
      if (fids.length > 0) {
        const rid = r._id.toString();
        const allHide = fids.every((fid) => {
          const folder = folderMap[fid];
          if (!folder?.adminOnly) return false;
          return !(folder.exceptions || []).includes(rid);
        });
        if (allHide) return false;
      }
      return true;
    });

    return NextResponse.json({
      totalRoutes: visible.length,
      totalDistanceM: visible.reduce((sum, r) => sum + (r.distance || 0), 0),
      totalUsers,
    });
  } catch (e) {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
