import { Dialog } from "@base-ui/react/dialog";
import {
  dayLabel,
  ENTRY_TEXT_MAX,
  newId,
  parseAmount,
  pressKey,
  TRANSACTION_TYPES,
  type TransactionType,
  TYPE_LABEL,
  toDecimalString,
  today,
} from "@money/shared";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBudgetNudge } from "../lib/budgetNudge";
import { isTyping, useMoney } from "../lib/hooks";
import {
  categoriesQuery,
  type Tx,
  useAiEntry,
  useDeleteTransaction,
  useSaveTransaction,
} from "../lib/queries";
import { DatePicker } from "./DatePicker";
import { BackspaceIcon, CloseIcon } from "./icons";
import { tween } from "./motion";
import { useToast } from "./Toast";
import { Button, cx, fieldClass, IconButton } from "./ui";

interface Draft {
  id: string;
  type: TransactionType;
  amount: string;
  categoryId: string | null;
  date: string;
  note: string;
  editing: boolean;
  /** The transaction as it was before this edit, so budget nudges count only the change. */
  original: Tx | null;
}

interface QuickAddApi {
  /** Opens a blank entry; `type` preselects Expense, Income or Invest. */
  openNew: (type?: TransactionType) => void;
  openEdit: (tx: Tx) => void;
}

const QuickAddContext = createContext<QuickAddApi | null>(null);

export function useQuickAdd(): QuickAddApi {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used inside <QuickAddProvider>");
  return ctx;
}

// Remember the last category used per type, so the common case is: N, type amount, Enter.
const lastKey = (type: TransactionType) => `mt:lastCategory:${type}`;
function readLast(type: TransactionType): string | null {
  try {
    return localStorage.getItem(lastKey(type));
  } catch {
    return null;
  }
}
function writeLast(type: TransactionType, id: string) {
  try {
    localStorage.setItem(lastKey(type), id);
  } catch {
    // storage unavailable (private mode); fine
  }
}

// Manual entry or "describe it" with AI. The last one picked sticks for the next new entry.
type Mode = "manual" | "ai";
const MODE_KEY = "mt:entryMode";
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "ai" ? "ai" : "manual";
  } catch {
    return "manual";
  }
}
function writeMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // storage unavailable; fine
  }
}

const AI_EXAMPLES = [
  "450 groceries",
  "Spent 1200 on dinner yesterday",
  "Salary 75000",
  "5000 into SIP",
];

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return today(d);
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Focus lands on the amount, not a button, so Enter saves instead of pressing Close.
  const amountRef = useRef<HTMLParagraphElement>(null);
  const refocusAmount = () => amountRef.current?.focus();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();
  const nudge = useBudgetNudge();
  const toast = useToast();
  const money = useMoney();
  const ai = useAiEntry();
  const [describe, setDescribe] = useState("");
  const describeRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    writeMode(m);
    // Wait a frame so the field for the new mode is mounted.
    requestAnimationFrame(() => (m === "ai" ? describeRef.current : amountRef.current)?.focus());
  };

  const pickCategory = useCallback(
    (type: TransactionType): string | null => {
      const usable = categories.filter((c) => c.kind === type && !c.archivedAt);
      const last = readLast(type);
      return usable.find((c) => c.id === last)?.id ?? usable[0]?.id ?? null;
    },
    [categories],
  );

  const openNew = useCallback(
    (type: TransactionType = "expense") => {
      setDescribe("");
      setDraft({
        id: newId(),
        type,
        amount: "",
        categoryId: pickCategory(type),
        date: today(),
        note: "",
        editing: false,
        original: null,
      });
    },
    [pickCategory],
  );

  const openEdit = useCallback((tx: Tx) => {
    setDraft({
      id: tx.id,
      type: tx.type,
      amount: toDecimalString(tx.amount).replace(/\.00$/, ""),
      categoryId: tx.categoryId,
      date: tx.date,
      note: tx.note ?? "",
      editing: true,
      original: tx,
    });
  }, []);

  const close = useCallback(() => setDraft(null), []);

  const minor = draft ? parseAmount(draft.amount) : null;
  const canSave = !!draft && !!minor && minor > 0 && !!draft.categoryId && !!draft.date;

  const submit = useCallback(() => {
    if (!draft || !canSave || !minor || !draft.categoryId) return;
    const vars = {
      id: draft.id,
      type: draft.type,
      amount: minor,
      categoryId: draft.categoryId,
      date: draft.date,
      note: draft.note.trim() || null,
    };
    const send = () =>
      save.mutate(vars, {
        onSuccess: () => void nudge(vars, draft.original),
        onError: (err) =>
          toast.show(`Couldn't save: ${err.message}`, {
            tone: "error",
            action: { label: "Retry", onClick: send },
          }),
      });
    send();
    writeLast(draft.type, draft.categoryId);
    toast.show(draft.editing ? "Updated" : `Saved ${money(minor)}`, {
      action: draft.editing ? undefined : { label: "Undo", onClick: () => remove.mutate(draft.id) },
    });
    close();
  }, [draft, canSave, minor, save, remove, toast, money, close, nudge]);

  /** "spent 500 on dinner yesterday": the server asks the model and saves it; we offer Undo. */
  const submitDescribe = useCallback(() => {
    const text = describe.trim();
    if (!draft || !text || ai.isPending) return;
    ai.mutate(
      { id: draft.id, text, today: today() },
      {
        onSuccess: ({ transaction: tx }) => {
          const category = categories.find((x) => x.id === tx.categoryId);
          const where = category ? ` · ${category.emoji} ${category.name}` : "";
          toast.show(`Added ${money(tx.amount)}${where} · ${dayLabel(tx.date)}`, {
            action: { label: "Undo", onClick: () => remove.mutate(tx.id) },
          });
          void nudge(tx, null);
          close();
        },
        onError: (err) => toast.show(err.message, { tone: "error" }),
      },
    );
  }, [describe, draft, ai, categories, toast, money, remove, nudge, close]);

  // Keyboard entry: digits, ".", Backspace edit the amount; Enter saves (unless a button has focus).
  const open = draft !== null;
  // Editing is always manual; the AI box only makes new entries.
  const aiMode = mode === "ai" && !!draft && !draft.editing;
  useEffect(() => {
    if (!open || aiMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (e.key === "Enter") {
        if (target.closest("button")) return;
        e.preventDefault();
        submit();
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === "Backspace" || e.key === "." || e.key === "," || /^\d$/.test(e.key)) {
        e.preventDefault();
        setDraft((d) => (d ? { ...d, amount: pressKey(d.amount, e.key) } : d));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, aiMode, submit]);

  // Global shortcut: N opens quick add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      openNew();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openNew]);

  const api = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit]);

  const visibleCategories = draft
    ? categories.filter(
        (c) => c.kind === draft.type && (!c.archivedAt || c.id === draft.categoryId),
      )
    : [];

  const setType = (type: TransactionType) =>
    setDraft((d) => (d ? { ...d, type, categoryId: pickCategory(type) } : d));

  return (
    <QuickAddContext.Provider value={api}>
      {children}
      <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/75 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup
            initialFocus={aiMode ? describeRef : amountRef}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[100dvh] flex-col overflow-y-auto rounded-t-xl border-2 border-line-strong/25 bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none transition duration-200 data-[ending-style]:translate-y-6 data-[starting-style]:translate-y-6 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-[ending-style]:translate-y-[-45%] sm:data-[starting-style]:translate-y-[-45%]"
          >
            {draft && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Close
                    render={
                      <IconButton label="Close" className="border-2 border-line-strong/25">
                        <CloseIcon />
                      </IconButton>
                    }
                  />
                  <Dialog.Title className="sr-only">
                    {draft.editing ? "Edit transaction" : "New transaction"}
                  </Dialog.Title>
                  {/* First choice: type it in yourself, or describe it and let the AI fill it in. */}
                  {!draft.editing && (
                    <div
                      className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1"
                      role="tablist"
                      aria-label="Entry mode"
                    >
                      {(["manual", "ai"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="tab"
                          aria-selected={mode === m}
                          onClick={() => setMode(m)}
                          className={cx(
                            "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-bold uppercase tracking-wider transition-colors",
                            mode === m
                              ? m === "ai"
                                ? "bg-accent text-on-accent"
                                : "bg-ink text-bg"
                              : "text-muted hover:text-ink",
                          )}
                        >
                          {m === "ai" ? (
                            <>
                              <span aria-hidden="true">✦</span> AI
                            </>
                          ) : (
                            "Manual"
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Then the type. In AI mode the model works it out from the sentence. */}
                {!aiMode && (
                  <div className="mt-4 grid grid-cols-3 gap-1.5" role="group" aria-label="Type">
                    {TRANSACTION_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={draft.type === t}
                        onClick={() => {
                          setType(t);
                          refocusAmount();
                        }}
                        className={cx(
                          "min-h-11 cursor-pointer rounded-lg px-2 text-sm font-bold uppercase tracking-wider",
                          draft.type === t
                            ? "bg-ink text-bg"
                            : "border-2 border-line-strong/25 text-muted",
                        )}
                      >
                        {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                )}

                {aiMode ? (
                  <form
                    className="mt-5 flex flex-col"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitDescribe();
                    }}
                  >
                    <label
                      htmlFor="qa-describe"
                      className="text-sm font-bold uppercase tracking-[0.12em] text-muted"
                    >
                      What happened?
                    </label>
                    <textarea
                      id="qa-describe"
                      ref={describeRef}
                      rows={3}
                      placeholder="Spent 500 on dinner yesterday"
                      value={describe}
                      maxLength={ENTRY_TEXT_MAX}
                      disabled={ai.isPending}
                      onChange={(e) => setDescribe(e.target.value)}
                      // Enter sends; Shift+Enter is a new line.
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || e.shiftKey) return;
                        e.preventDefault();
                        submitDescribe();
                      }}
                      className="mt-2 w-full resize-none rounded-xl border-2 border-line-strong/25 bg-transparent p-4 text-[22px] font-semibold leading-snug text-ink placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-60"
                    />
                    <p className="mt-2 text-[13px] text-faint">
                      Say the amount, what it was for and when. The category, type and date are
                      worked out for you, and you can undo it.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2" aria-label="Examples">
                      {AI_EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => {
                            setDescribe(ex);
                            describeRef.current?.focus();
                          }}
                          className="min-h-11 cursor-pointer rounded-lg border-2 border-line-strong/25 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-line-strong/60 hover:text-ink"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="submit"
                      disabled={!describe.trim() || ai.isPending}
                      className="mt-6 h-14 w-full text-lg sm:h-16"
                    >
                      {ai.isPending ? "Adding…" : describe.trim() ? "Add it" : "Describe it first"}
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="pt-4 sm:pt-8">
                      <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted">
                        {draft.editing ? "Editing" : "New"} · {draft.type}
                      </p>
                      <p
                        ref={amountRef}
                        tabIndex={-1}
                        aria-live="polite"
                        className={cx(
                          "mt-1 break-all text-[64px] font-bold leading-[0.95] tracking-[-0.06em] outline-none sm:mt-2 sm:text-[88px]",
                          draft.amount ? "text-accent" : "text-faint",
                        )}
                      >
                        {/* Each digit eases in as it is typed. */}
                        <AnimatePresence initial={false} mode="popLayout">
                          {(draft.amount || "0").split("").map((ch, i) => (
                            <motion.span
                              key={`${i}-${ch}`}
                              className="inline-block"
                              initial={{ y: "20%", opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ opacity: 0, transition: { duration: 0.08 } }}
                              transition={tween.fast}
                            >
                              {ch}
                            </motion.span>
                          ))}
                        </AnimatePresence>
                      </p>
                    </div>

                    {/* One swipeable row on phones so the keypad stays on screen; wraps on desktop. */}
                    <div
                      className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
                      role="group"
                      aria-label="Category"
                    >
                      {visibleCategories.map((c) => {
                        const selected = c.id === draft.categoryId;
                        return (
                          <motion.button
                            key={c.id}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            transition={tween.fast}
                            aria-pressed={selected}
                            onClick={() => {
                              setDraft({ ...draft, categoryId: c.id });
                              refocusAmount();
                            }}
                            className={cx(
                              "flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border-2 px-3.5 text-[15px] font-semibold",
                              selected
                                ? "text-on-accent"
                                : "border-line-strong/25 transition-colors hover:border-line-strong/60",
                            )}
                            style={
                              selected
                                ? {
                                    backgroundColor: `var(--cat-${c.color})`,
                                    borderColor: `var(--cat-${c.color})`,
                                  }
                                : undefined
                            }
                          >
                            <span aria-hidden="true">{c.emoji}</span>
                            {c.name}
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:mt-5 sm:gap-3">
                      <input
                        type="text"
                        aria-label="Note"
                        placeholder="Add a note"
                        value={draft.note}
                        maxLength={500}
                        onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                        className={cx(fieldClass, "min-h-11")}
                      />
                      <div className="flex items-center gap-1.5">
                        <DatePill
                          label="Today"
                          active={draft.date === today()}
                          onClick={() => {
                            setDraft({ ...draft, date: today() });
                            refocusAmount();
                          }}
                        />
                        <DatePill
                          label="Yesterday"
                          active={draft.date === yesterday()}
                          onClick={() => {
                            setDraft({ ...draft, date: yesterday() });
                            refocusAmount();
                          }}
                        />
                        <DatePicker
                          label="Date"
                          value={draft.date}
                          onChange={(date) => {
                            setDraft({ ...draft, date });
                            refocusAmount();
                          }}
                          className="ml-auto min-h-11"
                        />
                      </div>
                    </div>

                    {/* On-screen keypad for touch. Desktop uses the keyboard. */}
                    <div className="mt-3 hidden max-sm:grid [@media(pointer:coarse)]:grid grid-cols-3 gap-1.5">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "Backspace"].map(
                        (k) => (
                          <button
                            key={k}
                            type="button"
                            aria-label={
                              k === "Backspace" ? "Delete" : k === "." ? "Decimal point" : k
                            }
                            onClick={() =>
                              setDraft((d) => (d ? { ...d, amount: pressKey(d.amount, k) } : d))
                            }
                            className="flex h-14 cursor-pointer items-center justify-center rounded-[14px] bg-surface text-[26px] font-semibold transition-colors duration-100 hover:bg-surface-strong/60 active:bg-surface-strong"
                          >
                            {k === "Backspace" ? <BackspaceIcon /> : k}
                          </button>
                        ),
                      )}
                    </div>

                    <Button
                      onClick={submit}
                      disabled={!canSave}
                      className="mt-3 h-14 w-full text-lg sm:mt-5 sm:h-16"
                    >
                      {canSave && minor ? `Save ${money(minor)}` : "Enter an amount"}
                    </Button>
                    <p className="mt-3 hidden text-center text-[13px] text-faint sm:block">
                      Type the amount, press Enter to save
                    </p>
                  </>
                )}
              </>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </QuickAddContext.Provider>
  );
}

function DatePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "min-h-11 cursor-pointer rounded-lg px-3.5 text-sm font-semibold",
        active ? "bg-surface-strong text-ink" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
