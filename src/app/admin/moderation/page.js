"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, AlertTriangle, Check, Eye, EyeOff, Trash2, Image as ImageIcon, MessageCircle, Send } from "lucide-react";

const REASON_LABELS = {
  spam: "Спам",
  nsfw: "Неприемлемый контент",
  offensive: "Оскорбление",
  other: "Другое",
};

const STATUS_TABS = [
  { id: "pending", label: "Ожидают" },
  { id: "resolved", label: "Решённые" },
];

export default function AdminModerationPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("pending");
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [adminComments, setAdminComments] = useState({}); // { reportId: "text" }

  useEffect(() => {
    if (!loading && !hasPermission("route_posts.moderate")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchReports = useCallback(async () => {
    setLoadingData(true);
    const res = await authFetch(`/api/admin/reports?status=${status}&limit=30`);
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports);
      setTotal(data.total);
    }
    setLoadingData(false);
  }, [authFetch, status]);

  useEffect(() => {
    if (user && hasPermission("route_posts.moderate")) {
      fetchReports();
    }
  }, [user, status, fetchReports, hasPermission]);

  const handleAction = async (reportId, action) => {
    const targetType = reports.find((r) => r.id === reportId)?.targetType || "post";
    const targetLabel = targetType === "comment" ? "комментарий" : "пост";
    const labels = { approved: `Оставить ${targetLabel}?`, hidden: `Скрыть ${targetLabel}?`, deleted: `Удалить ${targetLabel}?` };
    if (action !== "approved" && !confirm(labels[action])) return;
    setProcessing(reportId);
    const res = await authFetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminComment: adminComments[reportId] || "" }),
    });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setTotal((t) => t - 1);
      setAdminComments((prev) => { const n = { ...prev }; delete n[reportId]; return n; });
    }
    setProcessing(null);
  };

  if (loading || !hasPermission("route_posts.moderate")) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24">
      <div className="sticky top-0 z-10 bg-[var(--bg-main)]/90 backdrop-blur-md border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex items-center gap-3 max-w-xl mx-auto">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h1 className="text-base font-bold text-[var(--text-primary)]">Модерация контента</h1>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Status tabs */}
        <div className="flex gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                status === tab.id
                  ? "bg-[var(--text-primary)] text-[var(--bg-main)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]"
              }`}
            >
              {tab.label}
              {tab.id === "pending" && total > 0 && status === "pending" && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{total}</span>
              )}
            </button>
          ))}
        </div>

        {/* Reports list */}
        {loadingData ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="h-4 w-32 bg-[var(--bg-elevated)] rounded mb-3" />
                <div className="h-20 bg-[var(--bg-elevated)] rounded" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-3 opacity-50" />
            <p className="text-sm text-[var(--text-muted)]">
              {status === "pending" ? "Нет жалоб на рассмотрении" : "Нет решённых жалоб"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="glass-card p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        report.reason === "nsfw" ? "bg-red-500/10 text-red-500" :
                        report.reason === "offensive" ? "bg-orange-500/10 text-orange-500" :
                        report.reason === "spam" ? "bg-yellow-500/10 text-yellow-600" :
                        "bg-gray-500/10 text-gray-500"
                      }`}>
                        {REASON_LABELS[report.reason] || report.reason}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        report.targetType === "comment"
                          ? "bg-blue-500/10 text-blue-500"
                          : report.postType === "photo"
                            ? "bg-purple-500/10 text-purple-500"
                            : "bg-cyan-500/10 text-cyan-500"
                      }`}>
                        {report.targetType === "comment" ? "Комментарий" : report.postType === "photo" ? "Фото" : "Пост"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text-secondary)]">{report.reporterUsername}</span>
                      {" → "}
                      <span className="font-medium text-[var(--text-secondary)]">{report.authorUsername}</span>
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {new Date(report.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  {report.action && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      report.action === "approved" ? "bg-green-500/10 text-green-500" :
                      report.action === "hidden" ? "bg-yellow-500/10 text-yellow-600" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {report.action === "approved" ? "Одобрен" : report.action === "hidden" ? "Скрыт" : "Удалён"}
                    </span>
                  )}
                </div>

                {/* Content preview */}
                <div className="rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] p-3">
                  {report.postImageUrl && (
                    <img src={report.postImageUrl} alt="" className="w-full max-h-40 object-cover rounded-lg mb-2" />
                  )}
                  {report.postText && (
                    <p className="text-sm text-[var(--text-primary)]">{report.postText}</p>
                  )}
                  {report.postStatus === "deleted" && !report.postText && (
                    <p className="text-xs text-red-500 italic">Контент удалён</p>
                  )}
                </div>

                {/* Reporter comment */}
                {report.comment && (
                  <p className="text-xs text-[var(--text-muted)] italic">&laquo;{report.comment}&raquo;</p>
                )}

                {/* Admin comment on resolved */}
                {report.adminComment && status === "resolved" && (
                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2">
                    <p className="text-[10px] text-blue-500 font-medium mb-0.5">Ответ модератора:</p>
                    <p className="text-xs text-[var(--text-secondary)]">{report.adminComment}</p>
                  </div>
                )}

                {/* Actions (only pending) */}
                {status === "pending" && (
                  <>
                    {/* Admin comment input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Комментарий для жалобщика (необязательно)"
                        value={adminComments[report.id] || ""}
                        onChange={(e) => setAdminComments((prev) => ({ ...prev, [report.id]: e.target.value }))}
                        maxLength={500}
                        className="flex-1 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(report.id, "approved")}
                        disabled={processing === report.id}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-green-600 bg-green-500/10 hover:bg-green-500/20 transition disabled:opacity-40"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Оставить
                      </button>
                      <button
                        onClick={() => handleAction(report.id, "hidden")}
                        disabled={processing === report.id}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20 transition disabled:opacity-40"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Скрыть
                      </button>
                      <button
                        onClick={() => handleAction(report.id, "deleted")}
                        disabled={processing === report.id}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 transition disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Удалить
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
