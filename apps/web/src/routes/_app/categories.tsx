import { Dialog } from "@base-ui/react/dialog";
import { CATEGORY_COLORS, type CategoryColor, type TransactionType } from "@money/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { CloseIcon, PlusIcon } from "../../components/icons";
import { useToast } from "../../components/Toast";
import {
  Button,
  cx,
  EmptyState,
  fieldClass,
  IconButton,
  Label,
  SectionHeader,
} from "../../components/ui";
import {
  type Category,
  categoriesQuery,
  useCreateCategory,
  useUpdateCategory,
} from "../../lib/queries";

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesPage,
});

const EMOJI_SUGGESTIONS = [
  "🍜",
  "🛒",
  "🚕",
  "🛍️",
  "💡",
  "🏠",
  "💊",
  "🎬",
  "✈️",
  "📦",
  "☕",
  "🍺",
  "🎁",
  "📚",
  "💻",
  "📱",
  "🐶",
  "👶",
  "🏋️",
  "💇",
  "🔧",
  "🎓",
  "💼",
  "💰",
  "📈",
  "🎮",
  "🚗",
  "⛽",
];

type Editing = { mode: "new"; kind: TransactionType } | { mode: "edit"; category: Category };

function CategoriesPage() {
  const { data: categories = [], isPending } = useQuery(categoriesQuery);
  const update = useUpdateCategory();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);

  const active = categories.filter((c) => !c.archivedAt);
  const archived = categories.filter((c) => c.archivedAt);

  const setArchived = (c: Category, archived: boolean) =>
    update.mutate(
      { id: c.id, archived },
      {
        onSuccess: () =>
          toast.show(archived ? `Archived ${c.name}` : `Restored ${c.name}`, {
            action: {
              label: "Undo",
              onClick: () => update.mutate({ id: c.id, archived: !archived }),
            },
          }),
        onError: (err) => toast.show(`Couldn't update: ${err.message}`, { tone: "error" }),
      },
    );

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <h1 className="text-5xl font-bold tracking-[-0.04em]">Categories</h1>

      {isPending ? null : (
        <>
          {(["expense", "income"] as const).map((kind) => {
            const list = active.filter((c) => c.kind === kind);
            return (
              <section key={kind}>
                <SectionHeader
                  title={kind === "expense" ? "Expenses" : "Income"}
                  right={
                    <button
                      type="button"
                      onClick={() => setEditing({ mode: "new", kind })}
                      className="flex min-h-6 cursor-pointer items-center gap-1 text-sm font-bold uppercase tracking-wider text-accent"
                    >
                      <PlusIcon size={16} />
                      Add
                    </button>
                  }
                />
                {list.length === 0 ? (
                  <EmptyState title={`No ${kind} categories`} />
                ) : (
                  <ul>
                    {list.map((c) => (
                      <CategoryRow
                        key={c.id}
                        category={c}
                        onEdit={() => setEditing({ mode: "edit", category: c })}
                        onArchive={() => setArchived(c, true)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {archived.length > 0 && (
            <section>
              <SectionHeader title="Archived" />
              <p className="mt-2 text-sm text-muted">
                Hidden from pickers. Past transactions keep their category.
              </p>
              <ul>
                {archived.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 border-b border-line py-2 opacity-70"
                  >
                    <Swatch category={c} />
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold">{c.name}</span>
                    <Button
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => setArchived(c, false)}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <CategoryDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Swatch({ category }: { category: Pick<Category, "emoji" | "color"> }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-xl"
      style={{ backgroundColor: `var(--cat-${category.color})` }}
    >
      {category.emoji}
    </span>
  );
}

function CategoryRow({
  category,
  onEdit,
  onArchive,
}: {
  category: Category;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        aria-label={`Edit ${category.name}`}
      >
        <Swatch category={category} />
        <span className="min-w-0 flex-1 truncate text-lg font-semibold">{category.name}</span>
      </button>
      <Button variant="ghost" className="min-h-11" onClick={onArchive}>
        Archive
      </Button>
    </li>
  );
}

function CategoryDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const toast = useToast();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [color, setColor] = useState<CategoryColor>("slate");
  const [seeded, setSeeded] = useState<Editing | null>(null);

  // Reset the form whenever the dialog opens for a new target.
  if (editing !== seeded) {
    setSeeded(editing);
    if (editing?.mode === "edit") {
      setName(editing.category.name);
      setEmoji(editing.category.emoji);
      setColor(editing.category.color as CategoryColor);
    } else if (editing) {
      setName("");
      setEmoji("📦");
      setColor("slate");
    }
  }

  const busy = create.isPending || update.isPending;
  const valid = name.trim().length > 0 && emoji.trim().length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !valid) return;
    const done = {
      onSuccess: onClose,
      onError: (err: Error) => toast.show(err.message, { tone: "error" }),
    };
    if (editing.mode === "new") {
      create.mutate({ name: name.trim(), emoji: emoji.trim(), color, kind: editing.kind }, done);
    } else {
      update.mutate(
        { id: editing.category.id, name: name.trim(), emoji: emoji.trim(), color },
        done,
      );
    }
  }

  return (
    <Dialog.Root open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/75 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[100dvh] overflow-y-auto rounded-t-xl border-2 border-line-strong/25 bg-bg p-5 outline-none transition duration-200 data-[ending-style]:translate-y-6 data-[starting-style]:translate-y-6 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-sm font-bold uppercase tracking-[0.12em]">
                {editing?.mode === "edit" ? "Edit category" : "New category"}
              </Dialog.Title>
              <Dialog.Close
                render={
                  <IconButton label="Close">
                    <CloseIcon />
                  </IconButton>
                }
              />
            </div>

            <label className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                className={fieldClass}
              />
            </label>

            <div className="flex flex-col gap-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Icon">
                {EMOJI_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={emoji === e}
                    aria-label={e}
                    onClick={() => setEmoji(e)}
                    className={cx(
                      "flex size-11 cursor-pointer items-center justify-center rounded-lg text-xl",
                      emoji === e ? "bg-surface-strong ring-2 ring-accent" : "hover:bg-surface",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={color === c}
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={cx(
                      "size-11 cursor-pointer rounded-lg border-2",
                      color === c ? "border-ink" : "border-transparent",
                    )}
                    style={{ backgroundColor: `var(--cat-${c})` }}
                  />
                ))}
              </div>
            </div>

            <Button type="submit" disabled={!valid || busy} className="h-14">
              {busy ? "Saving…" : "Save"}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
