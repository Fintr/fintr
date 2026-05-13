import fs from "fs"
import path from "path"

function readAuth0DomainFromEnvFiles(): string | undefined {
  const root = process.cwd()
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(root, name)
    if (!fs.existsSync(filePath)) {
      continue
    }
    const text = fs.readFileSync(filePath, "utf8")
    const line = text
      .split("\n")
      .find((l) => /^\s*NEXT_PUBLIC_AUTH0_DOMAIN\s*=/.test(l))
    if (!line) {
      continue
    }
    const raw = line.replace(/^\s*NEXT_PUBLIC_AUTH0_DOMAIN\s*=\s*/, "").trim()
    return raw.replace(/^["']|["']$/g, "")
  }
  return undefined
}

/**
 * Mirrors the domain suffix in `src/lib/auth-storage.ts` (`getAuth0Key`).
 * CI often has no `NEXT_PUBLIC_AUTH0_DOMAIN`, which yields the `"default"` suffix.
 */
export function auth0LocalStorageKeySuffix(): string {
  const raw =
    process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? readAuth0DomainFromEnvFiles()
  return raw?.replace(/\./g, "_") || "default"
}
