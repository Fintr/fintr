import { getDashboardBottomTab } from "@/lib/dashboard-nav-routes";

export function shouldResetScrollOnNavigate(
  fromPath: string,
  toPath: string,
): boolean {
  const fromTab = getDashboardBottomTab(fromPath);
  const toTab = getDashboardBottomTab(toPath);

  if (fromTab && toTab) {
    return false;
  }

  return true;
}
