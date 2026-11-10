import {
  type CategoryCreate,
  type CategoryUpdate,
  DEFAULT_SETTINGS,
  type Settings,
  type TransactionInput,
} from "@money/shared";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, authClient, unwrap } from "./api";

// ── Queries ─────────────────────────────────────────────────────────────────

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async () => (await authClient.getSession()).data ?? null,
  staleTime: 60_000,
});

const fetchCategories = async () => (await unwrap(await api.categories.$get())).categories;
const fetchTransactions = async (month: string) =>
  (await unwrap(await api.transactions.$get({ query: { month } }))).transactions;

export type Category = Awaited<ReturnType<typeof fetchCategories>>[number];
export type Tx = Awaited<ReturnType<typeof fetchTransactions>>[number];

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: fetchCategories,
  staleTime: 5 * 60_000,
});

export const transactionsQuery = (month: string) =>
  queryOptions({
    queryKey: ["transactions", month],
    queryFn: () => fetchTransactions(month),
  });

export const summaryQuery = (month: string) =>
  queryOptions({
    queryKey: ["summary", month],
    queryFn: async () => unwrap(await api.summary.$get({ query: { month } })),
  });

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => (await unwrap(await api.settings.$get())).settings,
  staleTime: 5 * 60_000,
});

export function useSettings(): Settings {
  const { data } = useQuery(settingsQuery);
  return data ?? DEFAULT_SETTINGS;
}

// ── Transaction mutations (optimistic) ──────────────────────────────────────

type SaveVars = { id: string } & TransactionInput;
type QC = ReturnType<typeof useQueryClient>;

function patchMonthLists(qc: QC, fn: (list: Tx[], month: string) => Tx[]) {
  for (const [key, data] of qc.getQueriesData<Tx[]>({ queryKey: ["transactions"] })) {
    if (!data) continue;
    qc.setQueryData(key, fn(data, String(key[1])));
  }
}

const refresh = (qc: QC) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ["transactions"] }),
    qc.invalidateQueries({ queryKey: ["summary"] }),
  ]);

export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...json }: SaveVars) =>
      unwrap(await api.transactions[":id"].$put({ param: { id }, json })),
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const previous = qc.getQueriesData<Tx[]>({ queryKey: ["transactions"] });
      const now = new Date().toISOString();
      const optimistic = {
        id,
        ...body,
        note: body.note || null,
        accountId: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      } as Tx;
      patchMonthLists(qc, (list, month) => {
        const without = list.filter((t) => t.id !== id);
        return body.date.startsWith(month) ? [optimistic, ...without] : without;
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => refresh(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.transactions[":id"].$delete({ param: { id } })),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const previous = qc.getQueriesData<Tx[]>({ queryKey: ["transactions"] });
      patchMonthLists(qc, (list) => list.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => refresh(qc),
  });
}

export function useRestoreTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.transactions[":id"].restore.$post({ param: { id } })),
    onSettled: () => refresh(qc),
  });
}

// ── Category and settings mutations ─────────────────────────────────────────

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: CategoryCreate) => unwrap(await api.categories.$post({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...json }: { id: string } & CategoryUpdate) =>
      unwrap(await api.categories[":id"].$patch({ param: { id }, json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: Partial<Settings>) => unwrap(await api.settings.$patch({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
