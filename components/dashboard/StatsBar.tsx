import type { DashboardStats } from "@/lib/dashboard/types";

const TILES: { key: keyof DashboardStats; label: string }[] = [
  { key: "strongMatches", label: "Strong matches" },
  { key: "saved", label: "Saved" },
];

// Two tiles: strong matches and saved jobs.
export function StatsBar({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TILES.map(({ key, label }) => (
        <div key={key} className="card p-4 shadow-[var(--shadow-lg)] sm:p-5">
          <div className="text-[26px] font-extrabold leading-none sm:text-[32px]">{stats[key]}</div>
          <div className="mt-2 text-[13px] font-medium text-[var(--muted)] sm:text-[15px]">{label}</div>
        </div>
      ))}
    </div>
  );
}
