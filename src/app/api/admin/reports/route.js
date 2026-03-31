import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions } from "@/lib/permissions";

// GET /api/admin/reports — список жалоб (посты + комментарии)
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const perms = await resolveUserPermissions(auth.user);
  if (!perms.includes("route_posts.moderate")) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const db = await getDb();

  const rawReports = await db.collection("route_post_reports")
    .find({ status })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  const total = await db.collection("route_post_reports").countDocuments({ status });

  // Собираем данные для каждого отчёта
  const reports = [];
  for (const r of rawReports) {
    const targetType = r.targetType || "post";
    let postText = null, postImageUrl = null, postType = null, postStatus = "deleted";

    if (targetType === "comment") {
      // Ищем в коллекции comments
      if (ObjectId.isValid(r.postId)) {
        const comment = await db.collection("comments").findOne({ _id: new ObjectId(r.postId) });
        if (comment) {
          postText = comment.text;
          postType = "comment";
          postStatus = "visible";
        }
      }
    } else {
      // Ищем в коллекции route_posts
      if (ObjectId.isValid(r.postId)) {
        const post = await db.collection("route_posts").findOne({ _id: new ObjectId(r.postId) });
        if (post) {
          postText = post.text;
          postImageUrl = post.imageUrl;
          postType = post.type;
          postStatus = post.status;
        }
      }
    }

    // Reporter
    let reporterUsername = "Удалён";
    if (ObjectId.isValid(r.reporterId)) {
      const reporter = await db.collection("users").findOne({ _id: new ObjectId(r.reporterId) }, { projection: { username: 1 } });
      if (reporter) reporterUsername = reporter.username;
    }

    // Author
    let authorUsername = "Удалён";
    if (ObjectId.isValid(r.postAuthorId)) {
      const author = await db.collection("users").findOne({ _id: new ObjectId(r.postAuthorId) }, { projection: { username: 1 } });
      if (author) authorUsername = author.username;
    }

    reports.push({
      id: r._id.toString(),
      postId: r.postId,
      routeId: r.routeId,
      targetType,
      reason: r.reason,
      comment: r.comment,
      status: r.status,
      action: r.action,
      adminComment: r.adminComment || null,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      reporterUsername,
      authorUsername,
      postText,
      postImageUrl,
      postType,
      postStatus,
    });
  }

  return NextResponse.json({ reports, total });
}
