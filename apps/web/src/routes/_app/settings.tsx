import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Select } from "../../components/Select";
import { useToast } from "../../components/Toast";
import { Button, Label, SectionHeader } from "../../components/ui";
import { authClient, queryClient } from "../../lib/api";
import { useSettings, useUpdateSettings } from "../../lib/queries";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED"];

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
        <div className="flex flex-col gap-1.5">
          <Label>Currency</Label>
          <Select
            label="Currency"
            value={settings.currency}
            onValueChange={(currency) => save({ currency })}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
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
