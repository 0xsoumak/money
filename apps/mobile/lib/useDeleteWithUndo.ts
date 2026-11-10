import { useToast } from "../components/Toast";
import { useMoney } from "./hooks";
import { type Tx, useDeleteTransaction, useRestoreTransaction } from "./queries";

/** Deletes a transaction (soft) and offers an Undo toast once the server has confirmed. */
export function useDeleteWithUndo() {
  const del = useDeleteTransaction();
  const restore = useRestoreTransaction();
  const toast = useToast();
  const money = useMoney();

  return (tx: Tx) =>
    del.mutate(tx.id, {
      onSuccess: () =>
        toast.show(`Deleted ${money(tx.amount)}`, {
          action: { label: "Undo", onClick: () => restore.mutate(tx.id) },
        }),
      onError: (err) => toast.show(`Couldn't delete: ${err.message}`, { tone: "error" }),
    });
}
