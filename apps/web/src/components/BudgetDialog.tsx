import { Dialog } from "@base-ui/react/dialog";
import { parseAmount, toDecimalString } from "@money/shared";
import { type FormEvent, useState } from "react";
import { useMoney } from "../lib/hooks";
import { useClearBudget, useSetBudget } from "../lib/queries";
import { CloseIcon } from "./icons";
import { useToast } from "./Toast";
import { Button, fieldClass, IconButton, Label } from "./ui";

export interface BudgetTarget {
  /** "overall" or a category id. */
  key: string;
  title: string;
  /** Current limit in minor units, if one is set. */
  current: number | null;
  /** What has been spent this month, shown as context. */
  spent: number;
}

/** Set, change or remove one monthly limit. */
export function BudgetDialog({
  target,
  onClose,
}: {
  target: BudgetTarget | null;
  onClose: () => void;
}) {
  const set = useSetBudget();
  const clear = useClearBudget();
  const toast = useToast();
  const money = useMoney();

  const [text, setText] = useState("");
  const [seeded, setSeeded] = useState<BudgetTarget | null>(null);
  if (target !== seeded) {
    setSeeded(target);
    if (target) {
      setText(target.current ? toDecimalString(target.current).replace(/\.00$/, "") : "");
    }
  }

  const amount = parseAmount(text);
  const valid = amount !== null && amount > 0;
  const busy = set.isPending || clear.isPending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target || !valid || amount === null) return;
    set.mutate(
      { key: target.key, amount },
      {
        onSuccess: () => {
          toast.show(`${target.title} limit set to ${money(amount)}`);
          onClose();
        },
        onError: (err) => toast.show(err.message, { tone: "error" }),
      },
    );
  }

  function onRemove() {
    if (!target) return;
    clear.mutate(target.key, {
      onSuccess: () => {
        toast.show(`Removed ${target.title} limit`);
        onClose();
      },
      onError: (err) => toast.show(err.message, { tone: "error" }),
    });
  }

  return (
    <Dialog.Root open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/75 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-2 border-line-strong/25 bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none transition duration-200 data-[ending-style]:translate-y-6 data-[starting-style]:translate-y-6 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-sm font-bold uppercase tracking-[0.12em]">
                  Monthly limit
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-lg font-semibold">
                  {target?.title}
                </Dialog.Description>
              </div>
              <Dialog.Close
                render={
                  <IconButton label="Close">
                    <CloseIcon />
                  </IconButton>
                }
              />
            </div>

            <label className="flex flex-col gap-1.5">
              <Label>Amount</Label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                autoFocus
                className={`${fieldClass} text-2xl font-bold`}
              />
            </label>

            <p className="text-sm text-muted">
              Applies to every month.{" "}
              {target ? `Spent so far this month: ${money(target.spent)}.` : ""}
            </p>

            <div className="flex gap-3">
              <Button type="submit" disabled={!valid || busy} className="h-14 flex-1">
                {busy ? "Saving…" : "Save limit"}
              </Button>
              {target?.current ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={onRemove}
                  className="h-14"
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
