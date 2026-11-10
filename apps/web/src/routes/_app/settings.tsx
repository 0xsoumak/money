import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useToast } from "../../components/Toast";
import { Button, fieldClass, Label, SectionHeader } from "../../components/ui";
import { authClient, queryClient } from "../../lib/api";
import { useSettings, useUpdateSettings } from "../../lib/queries";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED"];
const LOCALES = [
  { value: "en-IN", label: "English (India): 1,23,456" },
  { value: "en-US", label: "English (US): 123,456" },
  { value: "en-GB", label: "English (UK): 123,456" },
  { value: "de-DE", label: "German: 123.456" },
  { value: "fr-FR", label: "French: 123 456" },
];

function SettingsPage() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, {
      onSuccess: () => toast.show("Saved"),
      onError: (err) => toast.show(`Couldn't save: ${err.message}`, { tone: "error" }),
    });

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <h1 className="text-5xl font-bold tracking-[-0.04em]">Settings</h1>

      <section className="flex flex-col gap-5">
        <SectionHeader title="Money" />
        <label className="flex flex-col gap-1.5">
          <Label>Currency</Label>
          <select
            value={settings.currency}
            onChange={(e) => save({ currency: e.target.value })}
            className={fieldClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Number format</Label>
          <select
            value={settings.locale}
            onChange={(e) => save({ locale: e.target.value })}
            className={fieldClass}
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted">
          Changing the currency only changes how amounts are shown. It does not convert anything.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Account" />
        <div>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
