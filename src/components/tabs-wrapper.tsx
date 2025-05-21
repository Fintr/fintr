"use client";

import { Tabs } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
// path is like /landlords/inbox/123
function getDefaultValue(path: string) {
  let defaultValue: string = "transactions";

  if (path.includes("/dashboard/budgets")) {
    defaultValue = "budgets";
  } else if (path.includes("/dashboard/goals")) {
    defaultValue = "goals";
  } else if (path.includes("/dashboard/investments")) {
    defaultValue = "investments";
  } else if (path.includes("/dashboard/insights")) {
    defaultValue = "insights";
  } else if (path.includes("/dashboard/database")) {
    defaultValue = "database";
  }

  return defaultValue;
}

export function TabsWrapper({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [defaultValue, setDefaultValue] = useState(getDefaultValue(path));

  useEffect(() => {
    setDefaultValue(getDefaultValue(path));
  }, [path]);

  return (
    <Tabs defaultValue={defaultValue} value={defaultValue} className="w-full h-full">
      {children}
    </Tabs>
  );
}
