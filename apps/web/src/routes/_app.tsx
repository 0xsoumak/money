import { monthSchema } from "@money/shared";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { PlusIcon } from "../components/icons";
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
  { to: "/", label: "Overview" },
  { to: "/transactions", label: "Transactions" },
  { to: "/categories", label: "Categories" },
  { to: "/settings", label: "Settings" },
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
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-1 px-4 py-3 sm:px-6">
          <p className="text-xl font-bold uppercase tracking-wide">
            Money<span className="text-accent">.</span>
          </p>
          <nav
            aria-label="Main"
            className="order-3 -mx-2 flex w-full flex-wrap gap-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                search={(prev: { month?: string }) => ({ month: prev.month })}
                activeOptions={{ exact: item.to === "/" }}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold uppercase tracking-[0.08em] text-muted transition hover:text-ink"
                activeProps={{ className: "bg-ink !text-bg" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button onClick={openNew} className="ml-auto sm:ml-0">
            <PlusIcon size={20} />
            Add
            <kbd className="hidden rounded-md border-[1.5px] border-on-accent px-1.5 py-0.5 font-[inherit] text-xs sm:inline">
              N
            </kbd>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
