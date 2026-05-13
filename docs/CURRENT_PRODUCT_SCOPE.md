# Current Fintr product scope

This document is for **contributors and AI tooling**. It describes what Fintr **does not** ship as first-class product today, so we do not confuse roadmap or experimental UI with what users normally get.

## Goals and investments are not live product pillars today

As of the current codebase:

- **Goals** — There is **no dedicated Goals product** in the main dashboard experience for typical production users. A short **goal description** on the dashboard (and related API fields) may exist as lightweight copy, not a full goals workflow.
- **Investments** — There is **no dedicated Investments / portfolio product** in the main dashboard experience for typical production users.

### Where they still appear in the repo (and why)

| Location | Reason |
|----------|--------|
| `NEXT_PUBLIC_SHOW_V2` / `shouldShowV2Features()` in the frontend | Experimental or legacy **Goals** and **Investments** routes, navigation, and tabs are **gated off** unless `NEXT_PUBLIC_SHOW_V2 === 'true'`. Default deployments should behave as **no** goals or investments surfaces. |
| Landing / marketing | Copy may use aspirational language (e.g. “financial goals”). Treat that as **positioning**, not a guarantee of feature parity with the in-app shell. |
| Weekly check in (admin) | Lists `liked_areas` / `improve_areas` from the API; area IDs are defined in the frontend config and `ProductPulse::Operations::CreateFeedback` (goals and investments are intentionally excluded until those are real product areas). |

### Authoritative feature gate (frontend)

- **`apps/fintr-fe/src/lib/utils.ts`** — `shouldShowV2Features()` reads `process.env.NEXT_PUBLIC_SHOW_V2 === 'true'`.

If you add user-facing Goals or Investments behavior intended for production, update **this file** and the **V2 flag** story so they stay aligned.
