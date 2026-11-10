import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { ToastProvider } from "../components/Toast";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted">404</p>
      <h1 className="mt-2 text-4xl font-bold">Nothing here</h1>
      <Link to="/" className="mt-6 inline-block font-bold uppercase tracking-wider text-accent">
        Back to overview
      </Link>
    </main>
  ),
});
