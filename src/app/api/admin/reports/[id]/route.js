import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions } from "@/lib/permissions";
import { deleteFile } from "@/lib/storage";
import { createAndPushNotification } from "@/lib/notifications";

// PATCH /api/admin/reports/[id] — разрешить жалобу
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const perms = await resolveUserPermissions(auth.user);
  if (!perms.includes("route_posts.moderate")) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { action, adminComment } = await request.json(); // action: "approved" | "hidden" | "deleted"
  if (!["approved", "hidden", "deleted"].includes(action)) {
    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  const db = await getDb();

  const report = await db.collection("route_post_reports").findOne({ _id: new ObjectId(id) });
  if (!report) {
    return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
  }

  const adminCommentTrimmed = (adminComment || "").trim().slice(0, 500) || null;

  // Обновляем жалобу
  await db.collection("route_post_reports").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "resolved",
        action,
        adminComment: adminCommentTrimmed,
        resolvedBy: auth.user._id.toString(),
        resolvedAt: new Date(),
      },
    }
  );

  const targetType = report.targetType || "post";

  // Действие над контентом
  if (report.postId && ObjectId.isValid(report.postId)) {
    if (targetType === "comment") {
      // Действие над комментарием
      if (action === "deleted") {
        await db.collection("comments").deleteOne({ _id: new ObjectId(report.postId) });
        // Удаляем ответы на этот комментарий
        await db.collection("comments").deleteMany({ parentId: report.postId });
      }
      // "hidden" для комментариев = удаление (у комментариев нет статуса)
      if (action === "hidden") {
        await db.collection("comments").deleteOne({ _id: new ObjectId(report.postId) });
        await db.collection("comments").deleteMany({ parentId: report.postId });
      }
    } else {
      // Действие над постом ленты
      const post = await db.collection("route_posts").findOne({ _id: new ObjectId(report.postId) });
      if (post) {
        if (action === "hidden") {
          await db.collection("route_posts").updateOne(
            { _id: new ObjectId(report.postId) },
            { $set: { status: "hidden" } }
          );
        } else if (action === "deleted") {
          if (post.imageUrl) {
            try { await deleteFile(post.imageUrl); } catch {}
          }
          await db.collection("route_posts").deleteOne({ _id: new ObjectId(report.postId) });
        }
      }
    }

    // Резолвим все другие жалобы на тот же контент
    await db.collection("route_post_reports").updateMany(
      { postId: report.postId, status: "pending", _id: { $ne: new ObjectId(id) } },
      {
        $set: {
          status: "resolved",
          action,
          adminComment: adminCommentTrimmed,
          resolvedBy: auth.user._id.toString(),
          resolvedAt: new Date(),
        },
      }
    );
  }

  // Уведомление жалобщику о результате
  const actionLabels = {
    approved: "оставлен без изменений",
    hidden: "скрыт",
    deleted: "удалён",
  };
  const targetLabel = targetType === "comment" ? "Комментарий" : "Пост";

  await createAndPushNotification(report.reporterId, "report_resolved", {
    reportId: id,
    action,
    targetType,
    message: `${targetLabel} ${actionLabels[action]}`,
    adminComment: adminCommentTrimmed,
  });

  return NextResponse.json({ ok: true });
}
