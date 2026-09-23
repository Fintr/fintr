import type { LocalDbAdapter } from "./local-db-adapter";
import { SqliteLocalDbAdapter } from "./sqlite-local-db-adapter";

export type LocalDbAdapterKind = "sqlite";

export function createLocalDbAdapter(params?: {
  kind?: LocalDbAdapterKind;
}): LocalDbAdapter {
  const kind: LocalDbAdapterKind = params?.kind ?? "sqlite";

  switch (kind) {
    case "sqlite":
      return new SqliteLocalDbAdapter();
  }
}

