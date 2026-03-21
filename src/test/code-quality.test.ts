import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "fs"
import { resolve, join, basename } from "path"

/**
 * Recursively find all test files in a directory
 */
const findTestFiles = (dir: string): string[] => {
  const files: string[] = []

  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (item !== "node_modules" && item !== ".next") {
        files.push(...findTestFiles(fullPath))
      }
    } else if (item.endsWith(".test.ts") || item.endsWith(".test.tsx")) {
      // Skip this file itself
      if (!fullPath.includes("code-quality.test.ts")) {
        files.push(fullPath)
      }
    }
  }

  return files
}

// Get the regex pattern as a string to avoid self-detection
const TS_IGNORE_PATTERN = "@ts-ignore"
const TS_EXPECT_ERROR_PATTERN = "@ts-expect-error"

describe("Code Quality Checks", () => {
  describe("TypeScript Comments", () => {
    it("should not contain " + TS_IGNORE_PATTERN + " in test files (use " + TS_EXPECT_ERROR_PATTERN + " instead)", () => {
      const srcDir = resolve(__dirname, "../..")
      const testFiles = findTestFiles(srcDir)

      const filesWithTsIgnore: string[] = []

      testFiles.forEach((filePath) => {
        const content = readFileSync(filePath, "utf-8")

        // Check for @ts-ignore
        if (content.includes(TS_IGNORE_PATTERN)) {
          // Get relative path
          const relativePath = filePath.replace(srcDir, "")
          filesWithTsIgnore.push(relativePath)
        }
      })

      expect(
        filesWithTsIgnore,
        `Found ${TS_IGNORE_PATTERN} in test files. Use ${TS_EXPECT_ERROR_PATTERN} with description instead:\n${filesWithTsIgnore.join("\n")}`
      ).toEqual([])
    })

    it("should require descriptions on " + TS_EXPECT_ERROR_PATTERN + " comments", () => {
      const srcDir = resolve(__dirname, "../..")
      const testFiles = findTestFiles(srcDir)

      const filesWithInvalidTsExpectError: string[] = []

      testFiles.forEach((filePath) => {
        const lines = readFileSync(filePath, "utf-8").split("\n")

        lines.forEach((line, index) => {
          // Check for @ts-expect-error without description using string matching
          const indexOfPattern = line.indexOf(TS_EXPECT_ERROR_PATTERN)
          if (indexOfPattern !== -1) {
            const afterPattern = line.slice(indexOfPattern + TS_EXPECT_ERROR_PATTERN.length)
            const description = afterPattern.trim()
            // Require at least 10 characters of description
            if (description.length < 10) {
              const relativePath = filePath.replace(srcDir, "")
              filesWithInvalidTsExpectError.push(
                `${relativePath}:${index + 1} (description: "${description}")`
              )
            }
          }
        })
      })

      expect(
        filesWithInvalidTsExpectError,
        `Found ${TS_EXPECT_ERROR_PATTERN} without proper description (min 10 chars):\n${filesWithInvalidTsExpectError.join("\n")}`
      ).toEqual([])
    })
  })
})
