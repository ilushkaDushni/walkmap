import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center px-6 pt-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-surface)]">
        <Settings className="h-10 w-10 text-[var(--text-primary)]" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">Настройки</h1>
      <p className="text-sm text-[var(--text-muted)]">Раздел в разработке</p>
    </div>
  );
}
