// The few words above each analytics chart, and the big numbers at the top of the page.
// Web and mobile both use these so the two apps always say the same thing.
import type { MoneyFlow } from "./analytics";
import type { Decisions } from "./decisions";

export type Tone = "warn" | "good" | "info";
export type Takeaway = [text: string, tone: Tone];
type Money = (minor: number) => string;

const pct = (r: number) => `${Math.round(r * 100)}%`;

export function moneyFlowTakeaway(f: MoneyFlow, compact: Money): Takeaway {
  if (f.income === 0) return [`${compact(f.spent)} spent, no income logged`, "info"];
  if (f.shortfall > 0) return [`${compact(f.shortfall)} came from savings`, "warn"];
  if (f.kept > 0) return [`You kept ${pct(f.kept / f.income)} of what came in`, "good"];
  return ["Everything that came in went out", "info"];
}

export function spendingTakeaway(d: Decisions, compact: Money): Takeaway {
  const u = d.spending.usualByNow;
  if (!u) return [`${compact(d.current.spent)} spent${d.running ? " so far" : ""}`, "info"];
  const by = d.running ? " by now" : "";
  switch (d.spending.verdict) {
    case "above":
      return [`${compact(d.current.flexible - u.high)} above usual${by}`, "warn"];
    case "below":
      // Never praise spending when logging is thin: missing entries look like saving.
      return [
        `${compact(u.low - d.current.flexible)} below usual${by}`,
        d.logging.thin ? "info" : "good",
      ];
    default:
      return [`Within your usual range${by}`, "info"];
  }
}

export function investingTakeaway(d: Decisions, compact: Money): Takeaway {
  const { rate } = d.investing;
  const c = d.consistency;
  const head = rate !== null ? `${pct(rate)} of income` : `${compact(d.current.invested)} invested`;
  const investedNow = d.current.invested > 0;
  // Starting is worth encouraging, not a red mark for the months before.
  if (investedNow && c.investedMonths === 1 && c.months.length > 1)
    return [`${head} · your first month investing`, "good"];
  const regular =
    c.steadiness === "early" ? "" : ` · ${c.investedMonths} of ${c.months.length} months`;
  const tone: Tone =
    c.steadiness === "steady"
      ? "good"
      : (c.steadiness === "irregular" || c.steadiness === "none") && !investedNow
        ? "warn"
        : "info";
  return [head + regular, tone];
}

export interface HeroStat {
  label: string;
  value: string;
  /** One short line under the number. */
  sub?: string;
  tone?: Tone;
  /** Shown with the accent key, tying it to the investing chart. */
  accent?: boolean;
}

/**
 * The month in four numbers: spent, where it's heading (or the daily average once it's
 * over), what was kept from income, and what was invested.
 */
export function heroStats(
  input: {
    d: Decisions;
    flow: MoneyFlow;
    budget: number | null;
    /** Days with spending, and days counted, this month. */
    spentDays: number;
    counted: number;
  },
  money: Money,
  compact: Money,
): HeroStat[] {
  const { d, flow: f, budget, spentDays, counted } = input;
  const c = d.current;
  const [spendText, spendTone] = spendingTakeaway(d, compact);

  const spent: HeroStat = {
    label: d.running ? "Spent so far" : "Spent",
    value: money(c.spent),
    sub: spendText,
    tone: spendTone,
  };

  const p = d.spending.projected.mid;
  const outlook: HeroStat = d.running
    ? {
        label: "Likely by month end",
        value: money(p),
        ...(budget !== null
          ? p > budget
            ? { sub: `${compact(p - budget)} over budget`, tone: "warn" as const }
            : { sub: `${compact(budget - p)} under budget`, tone: "good" as const }
          : d.spending.usualMonth
            ? { sub: `Usually ${compact(d.spending.usualMonth.mid)}` }
            : {}),
      }
    : {
        label: "Per day",
        value: money(Math.round(c.spent / Math.max(1, d.days))),
        sub: `Spent on ${spentDays} of ${counted} days`,
      };

  const kept: HeroStat =
    f.income === 0
      ? { label: "Kept", value: "–", sub: "No income logged" }
      : f.shortfall > 0
        ? {
            label: "From savings",
            value: money(f.shortfall),
            sub: "More went out than came in",
            tone: "warn",
          }
        : {
            label: "Kept",
            value: money(f.kept),
            sub: `${pct(f.kept / f.income)} of ${compact(f.income)} income`,
            tone: f.kept > 0 ? "good" : "info",
          };

  const invested: HeroStat = {
    label: "Invested",
    accent: true,
    value: money(c.invested),
    sub:
      d.investing.rate !== null
        ? `${pct(d.investing.rate)} of income`
        : c.invested > 0
          ? "No income logged"
          : d.running
            ? "Nothing yet this month"
            : "Nothing this month",
    tone: c.invested > 0 ? "good" : "info",
  };

  return [spent, outlook, kept, invested];
}
