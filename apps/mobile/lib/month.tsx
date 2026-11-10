import { currentMonth } from "@money/shared";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

interface MonthState {
  month: string;
  setMonth: (month: string) => void;
}

const MonthContext = createContext<MonthState | null>(null);

/** The month shown across the tabs. Resets to the current month when the app restarts. */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth());
  const value = useMemo(() => ({ month, setMonth }), [month]);
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth(): MonthState {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used inside <MonthProvider>");
  return ctx;
}
