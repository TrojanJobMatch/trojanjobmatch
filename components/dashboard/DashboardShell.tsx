"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/auth/AuthShell";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { Filters } from "@/components/dashboard/Filters";
import { JobFeed } from "@/components/dashboard/JobFeed";
import { ProfileMenu, type Profile } from "@/components/dashboard/ProfileMenu";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { DEFAULT_FILTERS, type DashboardStats, type JobFilters } from "@/lib/dashboard/types";

interface Me extends Profile {
  skills: string[];
}

// Always-visible dashboard: cardinal band with the user's greeting, the
// agent panel overlapping the band, resume card, filters and the job feed.
export function DashboardShell() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data ? setMe(data) : router.push("/login")))
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => !data.error && setStats(data))
      .catch(() => undefined);
  }, [refreshKey]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const firstName = me?.name.split(" ")[0] ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[var(--cardinal-deep)] pb-14 pt-5 text-white sm:pb-16">
        <div className="container-tm">
          <div className="flex items-center justify-between gap-4">
            <Wordmark className="text-[20px] sm:text-[24px]" />
            {me && (
              <ProfileMenu
                profile={me}
                onChange={(patch) => setMe((current) => (current ? { ...current, ...patch } : current))}
                onSignOut={signOut}
              />
            )}
          </div>
          <h1 className="font-display mt-6 text-[30px] uppercase leading-none sm:text-[40px]">
            Fight on{firstName ? <>, <span className="text-[var(--gold)]">{firstName}</span></> : ""}.
          </h1>
          <p className="mt-2 text-[15px] text-white/85 sm:text-[16px]">Every Trojan deserves the right match.</p>
        </div>
      </header>

      <main className="container-tm -mt-8 flex flex-1 flex-col gap-6 pb-12">
        {/* Laptop and up: agent chat and resume side by side, both on the
            first screen. The resume column takes the chat's height. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_280px] md:gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <AgentPanel onJobsChanged={() => setRefreshKey((k) => k + 1)} />
          <div className="relative">
            <div className="md:absolute md:inset-0">
              <ResumeCard
                skills={me?.skills ?? []}
                onSkillsChange={(skills) => {
                  setMe((current) => (current ? { ...current, skills } : current));
                  setRefreshKey((k) => k + 1);
                }}
              />
            </div>
          </div>
        </div>

        <section id="jobs" aria-label="Jobs" className="flex scroll-mt-4 flex-col gap-3 pt-2">
          <Filters filters={filters} onChange={setFilters} stats={stats} />
          <JobFeed filters={filters} refreshKey={refreshKey} onDecisionMade={() => setRefreshKey((k) => k + 1)} />
        </section>

        <p className="text-center text-[13px] text-[var(--muted)]">
          A student project built at the AI@USC Hackathon. Not an official USC website.
        </p>
      </main>
    </div>
  );
}
