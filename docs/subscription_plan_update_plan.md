# Subscription Plan Update Implementation Plan

## Goal
Allow users to upgrade or downgrade their subscription plans mid-cycle while ensuring the business doesn't lose profit through proper proration and billing cycle management.

## Current State Analysis

### Existing Functionality
- ✅ **Create Subscription**: Users can create new subscriptions
- ✅ **Cancel Subscription**: Users can cancel subscriptions (with grace period)
- ❌ **Update Subscription**: No functionality exists to change plans mid-cycle

### Current Billing Cycle Model
- Each `Finance::BillingCycle` stores:
  - `tokens_allocated` - Token limit for that cycle (from subscription plan at creation time)
  - `span` - Date range (tstzrange) for the cycle
  - `status` - pending/paid/failed
  - `cycle_number` - Sequential cycle number

### Current Token Limit Logic
- `Space#current_token_limit` sums tokens from:
  - Active subscriptions: Uses `subscription_plan.token_limit`
  - Grace period subscriptions: Uses `current_paid_cycle.tokens_allocated`
  - Always adds `FREE_TOKENS` (30)

## Business Requirements

### Profit Protection Strategy

1. **Upgrades (Lower → Higher Plan)**
   - User should pay prorated difference for remaining days in current cycle
   - New plan tokens should be available immediately
   - Next cycle should charge full new plan amount

2. **Downgrades (Higher → Lower Plan)**
   - User should receive credit for unused portion of current cycle
   - Credit should be applied to next cycle's payment
   - Token limit should not reduce immediately, also we don't make any payment disbursements for the user. The user still experience the same amount of tokens until the next billing cycles.
   - Business should not lose money from already-paid cycles

3. **Same Plan Changes**
   - If user changes to same plan (edge case), no action needed

## Implementation Plan

### Phase 1: Xendit Integration for Plan Updates

#### 1.1 Update Xendit Client
- **File**: `fintr-be/lib/integrations/payments/xendit/client.rb`
- **Action**: Enhance `update_subscription_plan` method to support:
  - `amount` - New subscription price
  - `schedule` - New billing schedule (if changing interval)
  - `immediate_action_type` - Control proration behavior
  - `proration_type` - How to handle proration (if Xendit supports it)

#### 1.2 Research Xendit Proration Behavior
- Test Xendit's `PATCH /recurring/plans/{plan_id}` endpoint behavior:
  - Does it automatically prorate?
  - When does it charge/credit?
  - How does it handle current cycle?
  - What webhooks are triggered?

### Phase 2: Create Update Subscription Operation

#### 2.1 New Operation: `UpdateSubscription`
- **File**: `fintr-be/app/operations/finance/operations/subscriptions/update_subscription.rb`
- **Responsibilities**:
  1. Validate that subscription can be updated (active, not cancelled)
  2. Calculate proration if needed
  3. Call Xendit API to update plan
  4. Handle Xendit response
  5. Update local `SpaceSubscription` record
  6. Create/adjust billing cycles if needed
  7. Update token allocations

#### 2.2 Operation Structure
```ruby
module Finance
  module Operations
    module Subscriptions
      class UpdateSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:subscription_id).value(:string)
            required(:new_subscription_plan_id).value(:string)
            optional(:effective_date).maybe(:date_time) # When to apply change
          end
        end

        def call(params)
          params = step validate(params:)
          space = step find_space(params:)
          current_subscription = step find_subscription(params:, space:)
          new_plan = step find_new_plan(params:)
          _ = step validate_can_update(current_subscription:, new_plan:)
          proration = step calculate_proration(current_subscription:, new_plan:, params:)
          xendit_response = step update_xendit_subscription(
            current_subscription:,
            new_plan:,
            proration:
          )
          _ = step update_local_subscription(
            subscription: current_subscription,
            new_plan:,
            xendit_response:
          )
          _ = step handle_billing_cycle_adjustment(
            subscription: current_subscription,
            new_plan:,
            proration:
          )

          Success(current_subscription.reload)
        end

        private
        # ... implementation methods
      end
    end
  end
end
```

### Phase 3: Proration Calculation

#### 3.1 Proration Logic
- **File**: `fintr-be/app/operations/finance/operations/subscriptions/calculate_proration.rb`
- **Responsibilities**:
  - Calculate days remaining in current billing cycle
  - Calculate prorated amount for upgrade/downgrade
  - Determine if immediate charge/credit is needed

#### 3.2 Proration Formula
```ruby
def calculate_proration(current_subscription:, new_plan:, params:)
  current_cycle = current_subscription.current_paid_cycle
  return Success(no_proration: true) unless current_cycle

  cycle_start = current_cycle.started_at
  cycle_end = current_cycle.ends_at
  today = params[:effective_date] || Time.zone.now

  days_elapsed = (today - cycle_start).to_i
  total_days = (cycle_end - cycle_start).to_i
  days_remaining = total_days - days_elapsed

  old_daily_rate = current_subscription.subscription_plan.price_cents / total_days
  new_daily_rate = new_plan.price_cents / total_days

  # For upgrades: charge difference for remaining days
  # For downgrades: credit difference for remaining days
  prorated_amount = (new_daily_rate - old_daily_rate) * days_remaining

  Success({
    days_remaining: days_remaining,
    prorated_amount_cents: prorated_amount.round,
    old_plan: current_subscription.subscription_plan,
    new_plan: new_plan,
    current_cycle: current_cycle
  })
end
```

### Phase 4: Billing Cycle Management

#### 4.1 Strategy: Create New Cycle vs Adjust Existing

**Option A: Create Prorated Cycle (Recommended)**
- Create a new billing cycle for the prorated period
- End current cycle early
- New cycle starts immediately with new plan tokens
- Next cycle starts at normal interval

**Option B: Adjust Current Cycle**
- Update current cycle's `tokens_allocated` to new plan
- Adjust `span` to end early
- Create prorated payment for difference

**Decision: Considering we can adjust the schedule though, through this link `https://docs.xendit.co/apidocs/update-recurring-schedule` I think we can do option B. However we should initiate a payment with this link `https://docs.xendit.co/apidocs/create-session`. Only if the payment is made can we authorize the upgrade (if it's downgrade no changes except the subscription amount is lower so it will ask a lower amount on the next billing cycle. the tokens also don't change until the next billing cycle). You shouldn't adjust the billing cycle though they should stay the same so the user is not confused. The billing cycle should stay the same and the user should get more benefits if its an upgrade, and experience the downgrade later on the next billing cycle. Can you do that? Nevermind, lets do A.

**Recommendation**: Option A is cleaner and easier to track

#### 4.2 Billing Cycle Update Logic
```ruby
def handle_billing_cycle_adjustment(subscription:, new_plan:, proration:)
  return Success(true) if proration[:no_proration]

  current_cycle = proration[:current_cycle]
  effective_date = Time.zone.now

  # End current cycle early
  current_cycle.update!(
    span: (current_cycle.started_at..effective_date)
  )

  # Create prorated cycle for remaining period
  cycle_end = current_cycle.ends_at # Original end date
  prorated_cycle = subscription.billing_cycles.create!(
    cycle_number: current_cycle.cycle_number, # Same cycle number
    span: (effective_date..cycle_end),
    tokens_allocated: new_plan.token_limit,
    status: "pending",
    metadata: {
      prorated: true,
      old_plan_id: subscription.subscription_plan_id,
      new_plan_id: new_plan.id,
      prorated_amount_cents: proration[:prorated_amount_cents]
    }
  )

  Success(prorated_cycle)
end
```

### Phase 5: Token Limit Handling

#### 5.1 Immediate vs Cycle-End Token Changes

**Option A: Immediate Token Change (Recommended for Upgrades)**
- User gets new plan tokens immediately
- Better UX for upgrades
- For downgrades, could allow using remaining tokens until cycle end

**Option B: Cycle-End Token Change**
- Tokens change at end of current cycle
- Simpler logic
- Worse UX for upgrades

**Recommendation**: 
- **Upgrades**: Immediate token increase
- **Downgrades**: Allow using current tokens until cycle end, then reduce

#### 5.2 Update Token Limit Logic
```ruby
# In Spaces::Space#current_token_limit
def current_token_limit
  active_subscriptions = space_subscriptions.select do |sub|
    sub.active? || sub.in_grace_period?
  end

  return FREE_TOKENS if active_subscriptions.empty?

  total_tokens = active_subscriptions.sum do |subscription|
    if subscription.active?
      # Check if there's a prorated cycle with new plan
      prorated_cycle = subscription.billing_cycles
                                   .where("metadata->>'prorated' = 'true'")
                                   .where("span @> ?::timestamptz", Time.zone.now)
                                   .first

      if prorated_cycle
        # Use prorated cycle tokens (new plan)
        prorated_cycle.tokens_allocated
      else
        # Use current subscription plan tokens
        subscription.subscription_plan.token_limit
      end
    elsif subscription.in_grace_period?
      current_cycle = subscription.current_paid_cycle
      current_cycle ? current_cycle.tokens_allocated : 0
    else
      0
    end
  end

  FREE_TOKENS + total_tokens
end
```

### Phase 6: Payment Handling

#### 6.1 Prorated Payment Creation
- When Xendit processes proration, it may:
  - Charge immediately for upgrades
  - Credit for downgrades (applied to next cycle)
- We need to track prorated payments separately

#### 6.2 Payment Tracking
- Create `Finance::Payment` record for prorated amount
- Link to the prorated billing cycle
- Handle both immediate charges and credits

### Phase 7: API Endpoint

#### 7.1 Controller Action
- **File**: `fintr-be/app/controllers/api/v1/finance/subscriptions_controller.rb`
- **Action**: `update`
- **Route**: `PATCH /api/v1/finance/subscriptions/:id`

```ruby
def update
  operation = ::Finance::Operations::Subscriptions::UpdateSubscription.new.call(
    space_id: current_space.id.to_s,
    subscription_id: params[:id],
    new_subscription_plan_id: update_params[:subscription_plan_id],
    effective_date: update_params[:effective_date]
  )

  return render_unprocessable_content(details: operation.failure) unless operation.success?

  subscription = operation.value!
  serializer = ::Finance::SpaceSubscriptionSerializer.render_as_hash(subscription)

  render_success(
    data: { subscription: serializer },
    message: "Subscription updated successfully"
  )
end

private

def update_params
  params.permit(:subscription_plan_id, :effective_date)
end
```

### Phase 8: Webhook Handling

#### 8.1 New Webhook Events
- Xendit may send webhooks when plan is updated:
  - `recurring.plan.updated` (if exists)
  - `recurring.cycle.created` (for prorated cycle)
  - `recurring.cycle.succeeded` (for prorated payment)

#### 8.2 Webhook Handler Updates
- Update existing webhook handlers to recognize prorated cycles
- Handle prorated payments correctly
- Update billing cycles based on webhook data

### Phase 9: Frontend Integration

#### 9.1 Update Subscription UI
- Add "Change Plan" button/action
- Show plan comparison
- Display proration preview (if applicable)
- Show effective date

#### 9.2 API Integration
- Create mutation hook: `useUpdateSubscription`
- Handle success/error states
- Refresh subscription data after update

## Profit Protection Measures

### 1. Proration Calculation
- ✅ Always calculate proration for mid-cycle changes
- ✅ Charge immediately for upgrades
- ✅ Credit for downgrades (applied to next cycle)

### 2. Token Limit Management
- ✅ For upgrades: Immediate token increase (user pays for it)
- ✅ For downgrades: Allow current tokens until cycle end (already paid)

### 3. Billing Cycle Tracking
- ✅ Create separate prorated cycles for accurate tracking
- ✅ Maintain audit trail of plan changes
- ✅ Link payments to correct cycles

### 4. Validation
- ✅ Prevent invalid plan changes (e.g., downgrading to same plan)
- ✅ Ensure subscription is active before allowing updates
- ✅ Validate effective dates

## Testing Strategy

### Unit Tests
- Proration calculation for various scenarios
- Billing cycle creation/adjustment
- Token limit updates

### Integration Tests
- Xendit API calls
- Webhook handling
- Payment creation

### Edge Cases
- Plan change on cycle boundary
- Plan change with failed payment
- Multiple plan changes in same cycle
- Plan change during grace period

## Migration Considerations

### Database Changes
- No schema changes needed initially
- Use `metadata` JSONB field to track proration
- Consider adding `prorated_amount_cents` column later if needed

### Data Migration
- Existing subscriptions don't need migration
- New functionality only affects new plan changes

## Rollout Plan

1. **Phase 1**: Research and test Xendit proration behavior
2. **Phase 2**: Implement `UpdateSubscription` operation
3. **Phase 3**: Add proration calculation logic
4. **Phase 4**: Update billing cycle management
5. **Phase 5**: Add API endpoint
6. **Phase 6**: Frontend integration
7. **Phase 7**: Testing and validation
8. **Phase 8**: Gradual rollout (beta users first)

## Success Metrics

- ✅ Users can upgrade/downgrade without losing access
- ✅ Business receives prorated payments correctly
- ✅ No revenue loss from plan changes
- ✅ Token limits update appropriately
- ✅ Billing cycles tracked accurately

## Open Questions

1. **When should downgrades take effect?**
   - Immediately (reduce tokens) or at cycle end?
   - Recommendation: Allow current tokens until cycle end
   - Decision: let's go with allow current tokens until cycle end. 

2. **How to handle multiple plan changes in one cycle?**
   - Only allow one change per cycle?
   - Or allow multiple with cumulative proration?
   - Decision: Allow only one change per cycle.

3. **What if prorated payment fails?**
   - Revert plan change?
   - Retry payment?
   - Keep old plan?
   - Decision: Retry payment, don't make any changes to the records if the payment didn't push through.

4. **Should we show proration preview to users?**
   - Yes, for transparency
   - Calculate and display before confirmation
   - Decision: Yes.

