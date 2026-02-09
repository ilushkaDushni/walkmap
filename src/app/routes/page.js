import { MapPinOff } from "lucide-react";
import RoutesListClient from "./RoutesListClient";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// Хелпер: folderIds из маршрута (совместимость со старым folderId)
function getFolderIds(r) {
  if (Array.isArray(r.folderIds)) return r.folderIds.map(String);
  if (r.folderId) return [String(r.folderId)];
  return [];
}

export default async function RoutesPage() {
  const db = await getDb();

  const [routes, folders] = await Promise.all([
    db
      .collection("routes")
      .find({ status: "published" })
      .sort({ sortOrder: 1, createdAt: -1 })
      .toArray(),
    db.collection("folders").find({}).toArray(),
  ]);

  // Map папок
  const folderMap = {};
  for (const f of folders) {
    folderMap[f._id.toString()] = f;
  }

  // Определяем скрытость маршрута
  const serialized = routes.map((r) => {
    const rid = r._id.toString();
    let hidden = false;

    // Маршрут сам adminOnly
    if (r.adminOnly) {
      hidden = true;
    } else {
      // Проверяем папки: маршрут скрыт если ВСЕ его папки — adminOnly и он не в исключениях
      const fids = getFolderIds(r);
      if (fids.length > 0) {
        const allFoldersHide = fids.every((fid) => {
          const folder = folderMap[fid];
          if (!folder?.adminOnly) return false; // папка не скрытая — не прячет
          const exceptions = folder.exceptions || [];
          return !exceptions.includes(rid);
        });
        if (allFoldersHide) hidden = true;
      }
    }

    return {
      ...r,
      _id: rid,
      createdBy: r.createdBy?.toString?.() || null,
      _hidden: hidden,
    };
  });

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Маршруты</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Выберите маршрут и отправляйтесь на прогулку
        </p>
      </div>

      {serialized.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--text-muted)]">
          <MapPinOff className="mb-4 h-16 w-16" strokeWidth={1} />
          <p>Маршруты пока не добавлены</p>
        </div>
      ) : (
        <RoutesListClient routes={serialized} />
      )}
    </div>
  );
}
