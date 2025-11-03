# Error Handling Strategy: Railway Oriented Programming

## Overview

This application follows **Railway Oriented Programming (ROP)** principles using the `Dry::Operation` gem. The key insight is distinguishing between **expected failures** (part of business logic) and **unexpected failures** (bugs/system errors).

**Approach**: **All failures are reported to Sentry** with appropriate tags for filtering and analysis. This comprehensive reporting approach provides:

- **Systemic Issue Identification**: Patterns in expected failures reveal underlying system weaknesses
- **Root Cause Analysis**: Complete data enables thorough investigation of all failure types
- **Prevention**: Analyzing trends from all incidents helps prevent future errors
- **Transparency**: Full visibility fosters a culture of trust and learning
- **Better Decision-Making**: Accurate, complete data leads to informed management decisions

## Failure Types

### Expected Failures (Reported to Sentry as WARNINGS)

These are part of normal business logic flow and are reported to Sentry at WARNING level with `failure_type:expected` tag:

1. **Validation Errors** - User input validation failures from contracts
2. **Business Logic Violations** - Rule violations (e.g., "Account not found", "Already exists")
3. **Not Found Errors** - Resources that don't exist
4. **RecordInvalid from User Input** - Data that fails model validations

### Unexpected Failures (Reported to Sentry as ERRORS)

These indicate bugs or system issues and are reported to Sentry at ERROR level with `failure_type:unexpected` tag:

1. **Database Connection Errors** - PostgreSQL connection failures
2. **Programming Errors** - `NoMethodError`, `ArgumentError`, `StandardError` from unexpected code paths
3. **External Service Failures** - API timeouts, third-party service errors
4. **Unexpected Exceptions** - Any exception not explicitly handled as expected

## Usage Examples

### Pattern 1: Expected Failure (No Exception)

```ruby
def find_account(params:)
  account = Transactions::Account.find_by(name: params[:account_name])
  return Failure(account_name: "not found") unless account
  Success(account)
end
```

✅ **Already correct** - No exception, so it's automatically treated as expected.

### Pattern 2: Expected Failure with Exception (User Input Validation)

```ruby
# BEFORE (❌ Sent to Sentry unnecessarily)
def create_entity(params:)
  entity = Entities::Entity.new(params)
  entity.save!
  Success(entity)
rescue ActiveRecord::RecordInvalid => e
  Failure(errors: entity.errors.to_hash, error: e)
end

# AFTER (✅ Not sent to Sentry)
def create_entity(params:)
  entity = Entities::Entity.new(params)
  entity.save!
  Success(entity)
rescue ActiveRecord::RecordInvalid => e
  # This is an expected failure - user provided invalid data
  Failure(errors: entity.errors.to_hash, error: e, expected: true)
end
```

### Pattern 3: Unexpected Failure (System Error)

```ruby
# BEFORE (✅ Already correct, but explicit is better)
def save_to_database(record)
  record.save!
  Success(record)
rescue ActiveRecord::StatementInvalid => e
  Failure(errors: { database: "failed to save" }, error: e)
end

# AFTER (✅ Explicitly marked as unexpected)
def save_to_database(record)
  record.save!
  Success(record)
rescue ActiveRecord::StatementInvalid => e
  # Database connection issues are unexpected
  Failure(errors: { database: "failed to save" }, error: e, expected: false)
end
```

### Pattern 4: Using Helper Methods (Recommended)

When you include `FailureHandler`, you get helper methods:

```ruby
include FailureHandler

def find_account(params:)
  account = Transactions::Account.find_by(name: params[:account_name])
  return expected_failure(account_name: "not found") unless account
  Success(account)
rescue ActiveRecord::RecordNotFound => e
  expected_failure({ account_name: "not found" }, error: e)
end

def process_external_api(params:)
  response = ExternalAPI.call(params)
  Success(response)
rescue Timeout::Error => e
  # External service failures are unexpected
  unexpected_failure({ api: "timeout" }, error: e)
end
```

## Rules of Thumb

1. ✅ **No exception = Expected failure** - If you can detect without exception, it's expected
2. ✅ **User input validation = Expected** - `RecordInvalid` from user input is always expected
3. ✅ **Not found errors = Expected** - User requested something that doesn't exist
4. ✅ **Database/system errors = Unexpected** - Connection failures, timeouts, `StatementInvalid`
5. ✅ **Programming errors = Unexpected** - `NoMethodError`, `ArgumentError` indicate bugs
6. ✅ **StandardError catch-all = Unexpected** - Unless you know it's expected, mark as unexpected

## Migration Checklist

When updating operations:

- [ ] Find all `Failure(..., error: e)` patterns
- [ ] Ask: "Is this exception from user input or expected business logic?"
  - If YES → Add `expected: true`
  - If NO → Add `expected: false` (or leave default for unexpected)
- [ ] Update `RecordInvalid` rescues to use `expected: true`
- [ ] Update system errors (`StatementInvalid`, `Timeout::Error`) to use `expected: false`
- [ ] Test that all failures appear in Sentry with correct tags
- [ ] Verify expected failures appear as WARNINGS with `failure_type:expected`
- [ ] Verify unexpected failures appear as ERRORS with `failure_type:unexpected`

## Benefits

- **📊 Comprehensive Visibility** - ALL failures reported to Sentry with tags for filtering
- **🔍 Better Analysis** - Distinguish expected vs unexpected using Sentry tags (`failure_type`, `expected`)
- **📈 Pattern Recognition** - Identify systemic issues through analysis of all failures
- **📝 Explicit Intent** - Code clearly shows what's expected vs unexpected
- **🛡️ Maintainable** - Follows ROP principles consistently across codebase
- **🎯 Smart Filtering** - Use Sentry tags to filter by `failure_type:expected` or `failure_type:unexpected`

## Sentry Reporting

All failures are reported to Sentry with:
- **Tags**: `operation`, `failure_type` (expected/unexpected), `expected` (boolean)
- **Context**: Error details, operation class, whether failure was expected
- **Level**: WARNING for expected failures, ERROR for unexpected failures

This allows you to:
- Filter Sentry issues by `failure_type:expected` to see business logic patterns
- Filter by `failure_type:unexpected` to focus on bugs
- Analyze trends in expected failures to improve system design

## Implementation Details

The `FailureHandler` concern reports ALL failures:

1. **Failures with exceptions**: Reported via `Sentry.capture_exception`
2. **Failures without exceptions** (validation errors, not found): Reported via `Sentry.capture_message`
3. **Tags added**: `operation`, `failure_type` (expected/unexpected), `expected` (boolean)
4. **Context added**: Error details, operation class, whether failure was expected
5. **Level set**: WARNING for expected, ERROR for unexpected

- **Complete visibility** into all failure types
- **Smart filtering** by tags in Sentry dashboard
- **Trend analysis** across expected and unexpected failures
- **Root cause analysis** with full context and operation details
