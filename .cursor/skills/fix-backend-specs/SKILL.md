---
name: fix-backend-specs
description: Fix failing RSpec tests in the Rails backend. Use when bundle exec rspec shows failures, specs are red, or when tests fail in the fintr-be directory. Follows the create_specs playbook for test creation and fixing.
---

# Fix Backend Specs

Fixes failing RSpec tests in the Rails backend (`fintr-be`).

## When to Use

- Running `bundle exec rspec` shows failures
- `make specs` or `make mspecs` reports errors
- Tests fail after code changes
- New specs need to follow existing patterns
- Rubocop offenses in spec files

## Quick Start

### 1. Run Tests First

```bash
cd /Users/mikodagatan/Programming/fintr/fintr-be
mise exec -- bundle exec rspec --format progress 2>&1 | tail -50
```

Or with make:
```bash
make mspecs
```

### 2. Identify Failure Type

**Model validation errors**
- Error: `ActiveRecord::RecordInvalid: Validation failed: ...`
- Common: Zero amount validation, presence validations
- Fix: Update test data to use valid values

**Missing params method**
- Error: `NameError: undefined local variable or method '..._params'`
- File: Controller specs
- Fix: Add strong params method to controller

**Association/Factory errors**
- Error: `FactoryBot::InvalidFactoryError` or association errors
- Fix: Check factory definitions, ensure associations exist

**Contract validation errors**
- Error: Dry::Validation contract failures
- Fix: Update test params to match contract schema

### 3. Fix Categories

**Category 1: Invalid Test Data (Most Common)**

When model validations change, tests may use now-invalid data:

```ruby
# BAD - model now rejects zero amounts
let(:transaction) do
  create(:transaction, amount: Money.from_amount(0, "PHP"))
end

# GOOD - use valid non-zero amount
let(:transaction) do
  create(:transaction, amount: Money.from_amount(100, "PHP"))
end
```

If the test specifically tests zero amounts that are now invalid:

```ruby
# Option 1: Remove the test if behavior is no longer supported
# Option 2: Skip with reason
it "handles zero amounts", skip: "Model now validates against zero amounts" do
  # ...
end
```

**Category 2: Missing Controller Params**

```ruby
# In controller, add missing params method:
private

def note_suggestions_params
  params.permit(:category_name, :space_id)
end
```

**Category 3: Factory Issues**

```ruby
# Check factory uses valid data
FactoryBot.define do
  factory :transaction do
    amount { Money.from_amount(100, "PHP") }  # Not zero!
    date { Date.today }
    association :user
    association :space
    association :account
    association :category
  end
end
```

## Testing Infrastructure

### Project Structure

```
spec/
├── controllers/     # Controller specs (legacy, prefer requests/)
├── factories/       # FactoryBot definitions
├── models/          # Model specs
├── operations/      # Dry::Operation specs
├── queries/         # Query object specs
├── requests/        # Request specs (preferred for controllers)
├── support/         # Shared examples, helpers
├── rails_helper.rb  # Test configuration
└── spec_helper.rb   # Additional config
```

### Run Commands

```bash
# Run all specs
mise exec -- bundle exec rspec

# Run specific spec
mise exec -- bundle exec rspec spec/requests/api/v1/transactions_spec.rb

# Run with progress format
mise exec -- bundle exec rspec --format progress

# Parallel test run
mise exec -- bundle exec rails parallel:spec
```

### With Make

```bash
make specs spec/requests/api/v1/transactions_spec.rb
make mspecs spec/models/transaction_spec.rb
make test          # Run parallel specs
```

## Key Patterns (From create_specs Playbook)

### 1. One `it` Block Per Expectation

```ruby
# BAD
it "creates and validates" do
  expect { create }.to change { Model.count }.by(1)
  expect(result).to be_valid
  expect(result.name).to eq("Test")
end

# GOOD
it "creates a record" do
  expect { create }.to change { Model.count }.by(1)
end

it "is valid" do
  expect(result).to be_valid
end

it "has correct name" do
  expect(result.name).to eq("Test")
end
```

### 2. No `allow_any_instance_of`

```ruby
# BAD - don't do this
allow_any_instance_of(Transaction).to receive(:calculate).and_return(100)

# GOOD - inject dependency or use factory traits
create(:transaction, :with_calculated_amount)
```

### 3. Use Factories, Not Fixtures

```ruby
# BAD - manual creation
user = User.create!(email: "test@example.com", name: "Test")

# GOOD - factories
create(:user)
create(:user, :admin)  # with trait
create(:user, email: "custom@example.com")
```

### 4. Request Specs for Controllers

```ruby
# spec/requests/api/v1/transactions_spec.rb
RSpec.describe "Transactions" do
  describe "GET /api/v1/transactions" do
    it "returns success" do
      get "/api/v1/transactions", headers: auth_headers
      expect(response).to have_http_status(:ok)
    end
  end
end
```

### 5. Mock External Services

```ruby
before do
  allow(ExternalApi).to receive(:call).and_return(mock_response)
end
```

## Rubocop

Always check and fix rubocop offenses:

```bash
# Check offenses
mise exec -- bundle exec rubocop spec/operations/transactions/my_spec.rb

# Auto-fix
mise exec -- bundle exec rubocop -A spec/operations/transactions/my_spec.rb

# With make
make mrubocop spec/requests/api/v1/transactions_spec.rb
```

## Examples

### Example 1: Fix validation error

```ruby
# Failing test - model now validates amount != 0
RSpec.describe "Zero amount" do
  let(:transaction) do
    create(:transaction, amount: Money.from_amount(0, "PHP"))
  end

  it "handles zero" do
    expect(transaction).to be_persisted  # Fails!
  end
end

# Fixed - remove invalid test
# Or update to test valid behavior:
RSpec.describe "Small amounts" do
  let(:transaction) do
    create(:transaction, amount: Money.from_amount(0.01, "PHP"))
  end

  it "handles small amounts" do
    expect(transaction).to be_persisted
  end
end
```

### Example 2: Add missing controller params

```ruby
# Controller fix
class Api::V1::TransactionsController < ApplicationController
  def note_suggestions
    params = note_suggestions_params  # Was missing!
    # ...
  end

  private

  def note_suggestions_params
    params.permit(:category_name, :space_id, :query)
  end
end
```

### Example 3: Fix factory

```ruby
# factories/transactions.rb
FactoryBot.define do
  factory :transaction do
    # Was: amount { Money.from_amount(0, "PHP") }
    amount { Money.from_amount(100, "PHP") }

    user
    space
    account
    category
    date { Date.today }
  end
end
```

## Troubleshooting

**Database errors**
- Run: `make mdb-setup` to reset test DB
- Check: `database.yml` configuration

**Factory errors**
- Check factory defines all required associations
- Verify traits are properly defined

**Flaky tests**
- Add `aggregate_failures` to see all failures
- Check for time-based or order-dependent issues
- Use `Timecop` for time-sensitive tests

**Slow tests**
- Use `before(:all)` for expensive setup (carefully)
- Mock external API calls
- Use `build_stubbed` instead of `create` when possible

## Verification

After fixing, always run:

```bash
mise exec -- bundle exec rspec --format progress 2>&1 | tail -20
```

Verify:
- `0 failures`
- All tests pass
- Rubocop clean: `make mrubocop <file>`

## Related Resources

- Playbook: `.cursor/playbooks/create_specs.md`
- Request specs rule: `.cursor/rules/specs/request_specs.mdc`
- General spec rules: `.cursor/rules/specs/general_rules.mdc`
