---
name: create-specs
description: Create and fix RSpec specs for the Rails backend. Use when writing tests, fixing failing specs, or ensuring code coverage in apps/fintr-be. Runs commands from the fintr-be directory.
---

# Create Specs for fintr-be

Create and maintain RSpec test files for the Rails backend in `apps/fintr-be`.

## When to Use This Skill

Use this skill when:

- A user asks to write tests for a file
- `bundle exec rspec` shows failures in `apps/fintr-be`
- A new feature needs spec coverage
- Existing specs need updating after code changes

## Prerequisites

All commands in this skill run from:

```
apps/fintr-be/
```

## Steps

1. **Identify the target file**
   - Get the file location from the user
   - This file lives in `apps/fintr-be/`

2. **Find or create the spec file**
   - Look for the corresponding spec under `spec/`
   - If it exists, proceed to step 3
   - If not, create it based on best practices and similar existing specs

3. **Check for code changes** (if spec already exists)
   - Run `git diff <relative_location>` from `apps/fintr-be/`
   - Use the diff to understand what spec updates are needed

4. **Write or update the spec**
   - Read at least 3 nearby spec files to match the project's style
   - For controllers (`app/controllers/api/v1/...`), write **request specs**, not controller specs
   - Follow the rules in `.ai/rules/specs/request_specs.mdc` for controller testing

5. **Run the spec**

   ```bash
   bundle exec rspec <location>
   ```

   If that fails, run:

   ```bash
   make mspecs <location>
   ```

6. **Fix failures**
   - Review the error output
   - Update **only the spec file** to match the implementation
   - Do not modify the source code
   - Repeat step 5 until passing

7. **Run RuboCop**

   ```bash
   bundle exec rubocop <location>
   ```

   Auto-correct if possible:

   ```bash
   bundle exec rubocop -A <location>
   ```

   If that doesn't work:

   ```bash
   make mrubocop <location>
   ```

8. **Final verification**
   - Both RSpec and RuboCop must pass
   - End the session once green

## Special Cases

- **Controllers**: Always use request specs. See `.ai/rules/specs/request_specs.mdc`
- **Models**: Use model specs with factories
- **Operations/Services**: Use unit specs mocking dependencies
- **Jobs**: Use job specs testing the `perform` method
