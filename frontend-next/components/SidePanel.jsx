import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LineChart, NotebookPen } from "lucide-react";

const ITEMS = [
  { key: "analyzer", label: "Analysis", icon: LineChart },
  { key: "diary", label: "Diary", icon: NotebookPen },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
];

export default function SidePanel({
  activeSection,
  onSectionChange,
  includeAnalysis = true,
  includeDiary = true,
  includeCalendar = true,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = ITEMS.filter((item) => {
    if (item.key === "analyzer") return includeAnalysis;
    if (item.key === "diary") return includeDiary;
    if (item.key === "calendar") return includeCalendar;
    return true;
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mhva-sidepanel-collapsed");
      if (saved === "1") {
        setCollapsed(true);
      }
    } catch {
      setCollapsed(false);
    }
  }, []);

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem("mhva-sidepanel-collapsed", next ? "1" : "0");
    } catch {
      // Ignore storage errors and keep UI responsive.
    }
  }

  return (
    <aside
      className={`sticky top-24 h-fit rounded-[1.5rem] border border-white/10 bg-white/6 p-4 shadow-soft backdrop-blur-2xl transition-all duration-300 ${
        collapsed ? "w-[88px]" : "w-[250px]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        {!collapsed ? <p className="px-2 text-xs uppercase tracking-[0.18em] text-white/45">Workspace</p> : <span />}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={collapsed ? "Expand side panel" : "Collapse side panel"}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/75 transition hover:bg-white/10"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;

          if (item.key === "calendar") {
            return (
              <Link
                key={item.key}
                href="/calendar"
                title={item.label}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border-white bg-white text-ink-950"
                    : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSectionChange?.(item.key)}
              title={item.label}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-white bg-white text-ink-950"
                  : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
