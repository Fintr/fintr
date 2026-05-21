---
name: create-be-specs
description: Create, update, and fix RSpec specs for the Rails backend (apps/fintr-be). Use when writing tests, fixing failing specs, or ensuring code coverage.
---

# Create BE Specs

Create, update, and fix RSpec test files for the Rails backend in `apps/fintr-be`.

## When to Use

- A user asks to write tests for a backend file
- `bundle exec rspec` shows failures
- A new feature needs spec coverage
- Existing specs need updating after code changes
- RuboCop offenses in spec files

## Working Directory

All commands run from:

```
/Users/mikodagatan/Programming/fintr/apps/fintr-be
```

## Workflow

### 1. Identify Target

Get the file location from the user. Determine the spec type and path:

| File Type   | Source Location                                | Spec Location                                  |
| ----------- | ---------------------------------------------- | ---------------------------------------------- |
| Controllers | `app/controllers/api/v1/budgets_controller.rb` | `spec/requests/api/v1/budgets_spec.rb`         |
| Models      | `app/models/transaction.rb`                    | `spec/models/transaction_spec.rb`              |
| Queries     | `app/queries/budgets/monthly_budgets.rb`       | `spec/queries/budgets/monthly_budgets_spec.rb` |
| Operations  | `app/operations/...`                           | `spec/operations/...`                          |
| Jobs        | `app/jobs/...`                                 | `spec/jobs/...`                                |

> **Note:** Request specs drop the `_controller` suffix.

### 2. Find or Create Spec

- Look for the corresponding spec under `spec/`
- If it exists, check for code changes: `git diff <relative_path>`
- If not, create it based on similar existing specs

**Before writing, read at least 3 nearby spec files to match project style.**

### 3. Write or Update

Follow the rules below for each spec type.

#### General Rules (All Specs)

- **One `it` block per expectation**
- **Never use `allow_any_instance_of`**
- **Only mock/stub when calling other models, operations, or queries** — test the code in the target file
- **Use factories, not manual creation**

```ruby
# BAD
it "creates and validates" do
  expect { create }.to change { Model.count }.by(1)
  expect(result).to be_valid
end

# GOOD
it "creates a record" do
  expect { create }.to change { Model.count }.by(1)
end

it "is valid" do
  expect(result).to be_valid
end
```

#### Request Specs (`spec/requests/**`)

Always require authorization:

```ruby
let!(:auth) { setup_authentication(user:, space:) }
let(:headers) { auth[:headers] }

it "returns success" do
  get "/api/v1/transactions", headers:
  expect(response).to have_http_status(:ok)
end
```

#### Query Specs (`spec/queries/**`)

- **Avoid mocks/stubs** — test real query results
- **Create many scenarios** based on contract parameters
- **Top-level context = contract parameters**; nest contexts for variations
- **Test the `validate` method** — required params missing should expect errors
- **Find `@relation`** by checking the query's `BaseQuery` parent

#### Model Specs (`spec/models/**`)

- Use factories with valid data (avoid zero amounts if validated)
- Test validations, associations, and scopes

#### Operation/Service Specs

- Unit test the `call` or `perform` method
- Mock external dependencies
- Test both success and failure paths

### 4. Run the Spec

```bash
mise exec -- bundle exec rspec <path>
```

Or with make:

```bash
make mspecs <path>
```

After changing multiple backend files, run scoped specs for everything you touched:

```bash
make mchanged-specs
```

See skill `rspec-changed` for path mapping and the pre-commit hook workflow.

### 5. Fix Failures

Review error output. Update **only the spec file** to match the implementation. Do not modify source code. Repeat step 4 until passing.

**Common failure types:**

| Error                                                        | Cause                     | Fix                                                                             |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------- |
| `ActiveRecord::RecordInvalid`                                | Invalid test data         | Use valid factory values                                                        |
| `NameError: undefined local variable or method '..._params'` | Missing strong params     | Add private params method to controller (spec only validates existing behavior) |
| `FactoryBot::InvalidFactoryError`                            | Factory uses invalid data | Fix factory to use valid values                                                 |
| `Dry::Validation` contract failures                          | Wrong test params         | Match params to contract schema                                                 |

**Example: fix invalid test data**

```ruby
# BAD — model now rejects zero amounts
let(:transaction) { create(:transaction, amount: Money.from_amount(0, "PHP")) }

# GOOD
let(:transaction) { create(:transaction, amount: Money.from_amount(100, "PHP")) }
```

If testing a now-invalid scenario, skip with reason:

```ruby
it "handles zero amounts", skip: "Model now validates against zero amounts" do
  # ...
end
```

### 6. Run RuboCop

```bash
mise exec -- bundle exec rubocop <path>
mise exec -- bundle exec rubocop -A <path>   # auto-fix
```

Or:

```bash
make mrubocop <path>
```

### 7. Final Verification

- RSpec passes: `0 failures`
- RuboCop clean

## Running All Specs

```bash
# All specs
mise exec -- bundle exec rspec

# Progress format
mise exec -- bundle exec rspec --format progress

# Parallel
mise exec -- bundle exec rails parallel:spec

# With make
make mspecs          # single spec
make test            # parallel run
make specs           # all specs
```

## Troubleshooting

| Issue           | Solution                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| Database errors | `make mdb-setup` to reset test DB                                         |
| Factory errors  | Check all required associations exist                                     |
| Flaky tests     | Add `aggregate_failures`; use `Timecop` for time-sensitive tests          |
| Slow tests      | Mock external APIs; use `build_stubbed` instead of `create` when possible |

## Related

- `.ai/rules/specs/general_rules.mdc`
- `.ai/rules/specs/request_specs.mdc`
- `.ai/rules/specs/model_specs.mdc`
- `.ai/rules/specs/query_specs.mdc`
