"use client";

import { Tabs } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { shouldShowV2Features } from "@/lib/utils";

// path is like /landlords/inbox/123
function getDefaultValue(path: string) {
  let defaultValue: string = "transactions";
  const showV2Features = shouldShowV2Features();

  if (path.includes("/dashboard/budgets")) {
    defaultValue = "budgets";
  } else if (path.includes("/dashboard/loans")) {
    defaultValue = "loans";
  } else if (path.includes("/dashboard/goals")) {
    defaultValue = "goals";
  } else if (showV2Features && path.includes("/dashboard/investments")) {
    defaultValue = "investments";
  } else if (path.includes("/dashboard/insights")) {
    defaultValue = "insights";
  } else if (path.includes("/dashboard/space_settings")) {
    defaultValue = "space_settings";
  }

  return defaultValue;
}

export function TabsWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [value, setValue] = useState<string>(() => getDefaultValue(pathname));

  useEffect(() => {
    setValue(getDefaultValue(pathname));
  }, [pathname]);

  return <Tabs value={value}>{children}</Tabs>;
}
