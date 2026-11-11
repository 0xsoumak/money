import { monthSchema } from "@money/shared";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { motion } from "motion/react";
import { z } from "zod";
import {
  GridIcon,
  HomeIcon,
  ListIcon,
  MeterIcon,
  PlusIcon,
  SlidersIcon,
} from "../components/icons";
import { spring } from "../components/motion";
import { QuickAddProvider, useQuickAdd } from "../components/QuickAdd";
import { Button } from "../components/ui";
import { categoriesQuery, sessionQuery, settingsQuery } from "../lib/queries";

export const Route = createFileRoute("/_app")({
  validateSearch: z.object({ month: monthSchema.optional().catch(undefined) }),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async ({ context }) => {
    // Needed by every page; warm the cache so nothing renders half-empty.
    await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(settingsQuery),
    ]);
  },
  component: AppLayout,
});

const NAV = [
  { to: "/", label: "Overview", tab: "Overview", Icon: HomeIcon },
  { to: "/transactions", label: "Transactions", tab: "Activity", Icon: ListIcon },
  { to: "/budgets", label: "Budgets", tab: "Budgets", Icon: MeterIcon },
  { to: "/categories", label: "Categories", tab: "Categories", Icon: GridIcon },
  { to: "/settings", label: "Settings", tab: "Settings", Icon: SlidersIcon },
] as const;

function AppLayout() {
  return (
    <QuickAddProvider>
      <Shell />
    </QuickAddProvider>
  );
}

function Shell() {
  const { openNew } = useQuickAdd();
  return (
    <div className="min-h-dvh">
      <header className="border-b-2 border-line-strong">
        <div className="mx-auto flex max-w-[1200px] items-center gap-x-7 px-4 py-3 sm:px-6">
          <p className="text-xl font-bold uppercase tracking-wide">
            Money<span className="text-accent">.</span>
          </p>
          {/* Desktop: top navigation. Phones use the bottom tab bar below. */}
          <nav aria-label="Main" className="hidden flex-1 gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                search={(prev: { month?: string }) => ({ month: prev.month })}
                activeOptions={{ exact: item.to === "/" }}
                className="relative inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
                activeProps={{ className: "!text-bg" }}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        transition={spring.snappy}
                        className="absolute inset-0 rounded-lg bg-ink"
                      />
                    )}
                    <span className="relative">{item.label}</span>
                  </>
                )}
              </Link>
            ))}
          </nav>
          <Button onClick={openNew} className="group ml-auto sm:ml-0">
            <span className="transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:rotate-90">
              <PlusIcon size={20} />
            </span>
            Add
            <kbd className="hidden rounded-md border-[1.5px] border-on-accent px-1.5 py-0.5 font-[inherit] text-xs sm:inline">
              N
            </kbd>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 pb-32 pt-6 sm:px-6 sm:pb-24">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-line-strong bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {NAV.map(({ to, tab, Icon }) => (
          <Link
            key={to}
            to={to}
            search={(prev: { month?: string }) => ({ month: prev.month })}
            activeOptions={{ exact: to === "/" }}
            className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted"
            activeProps={{ className: "!text-accent" }}
          >
            {({ isActive }) => (
              <>
                <motion.span
                  animate={isActive ? { y: [0, -4, 0], scale: [1, 1.15, 1] } : { y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <Icon />
                </motion.span>
                {tab}
              </>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
