# Subscription Grace Period Implementation Plan

## Goal
When a subscription is cancelled/deactivated, users who have already paid for the current billing period should retain access to their tokens until the end of that billing cycle. The grace period ends when the paid billing cycle expires.

## Current State Analysis

### Existing Models & Fields
- **`Finance::SpaceSubscription`**:
  - `started_at` - When subscription started
  - `ended_at` - When subscription ended (set on cancellation)
  - `status` - active/inactive/pending/requires_action
  - `current_cycle_count` - Current billing cycle number
  - `metadata` - JSONB field storing Xendit webhook data

- **`Finance::Payment`**:
  - `paid_at` - When payment was successfully processed
  - `status` - succeeded/failed/pending/refunded
  - `xendit_cycle_id` - Links payment to Xendit billing cycle

- **`Space.current_token_limit`**:
  - Currently only checks for active subscriptions
  - Returns subscription plan's `token_limit` if active, else default `SPACE_TOKEN_LIMIT`

### Current Flow
1. Subscription is cancelled → `status` = "inactive", `ended_at` = Time.current
2. Token limit immediately drops to default (no grace period)
3. Users lose access even if they've paid for current period

## Required Changes

### 1. Database Migration - Create `finance_billing_cycles` Table

**New table: `finance_billing_cycles`**
- `id` (uuid, primary key)
- `space_subscription_id` (uuid, foreign key to `finance_space_subscriptions`)
- `cycle_number` (integer) - Recurrence number from Xendit (1, 2, 3, etc.)
- `started_at` (datetime) - When this billing cycle started
- `ends_at` (datetime) - When this billing cycle ends (calculated using `Utils::Recurrence`)
- `paid_at` (datetime, nullable) - When payment succeeded for this cycle
- `status` (enum: pending/paid/failed/expired) - Current status of the cycle
- `tokens_allocated` (integer) - Token limit for this cycle (from subscription plan)
- `xendit_cycle_id` (string, nullable, indexed unique) - Xendit cycle ID for tracking (extracted from `data.dig(:cycle, :id)` or `data[:cycle_id]`)
- `xendit_action_id` (string, nullable) - Xendit action ID when payment succeeded (extracted from `data.dig(:action, :id)` or `data[:action_id]`)
- `metadata` (jsonb) - Additional cycle data from Xendit
- `created_at`, `updated_at` (timestamps)

**Indexes:**
- `space_subscription_id`, `cycle_number` (unique together)
- `space_subscription_id`, `status`
- `ends_at` (for querying active cycles)
- `xendit_cycle_id` (unique, nullable) - Critical for finding cycles from webhooks
- `xendit_action_id` (indexed, nullable) - For linking to payments

**Add to `finance_space_subscriptions` table:**
- `cancelled_at` (datetime, nullable) - When cancellation was requested

**Rationale:**
- **BillingCycle model**: Provides precise tracking of each billing cycle, payment status, and token expiration
- **Uses `Utils::Recurrence.usage_period`**: Calculates cycle periods based on subscription plan interval (month/year)
- **Grace period logic**: Simply check if there's a paid cycle that hasn't expired
- **Token expiration**: Tokens expire when the cycle ends, not based on cancellation date

### 2. Model Updates

#### New Model: `Finance::BillingCycle`
```ruby
module Finance
  class BillingCycle < ApplicationRecord
    self.table_name = "finance_billing_cycles"
    
    belongs_to :space_subscription, class_name: "Finance::SpaceSubscription"
    
    enum :status, {
      pending: "pending",
      paid: "paid",
      failed: "failed",
      expired: "expired"
    }
    
    validates :cycle_number, presence: true, uniqueness: { scope: :space_subscription_id }
    validates :started_at, presence: true
    validates :ends_at, presence: true
    validates :tokens_allocated, presence: true, numericality: { greater_than: 0 }
    
    scope :paid, -> { where(status: :paid) }
    scope :active, -> { where("ends_at > ?", Time.current) }
    scope :paid_and_active, -> { paid.active }
    scope :for_subscription, ->(subscription_id) { where(space_subscription_id: subscription_id) }
    scope :current, -> { order(cycle_number: :desc).limit(1) }
    
    def expired?
      ends_at < Time.current
    end
    
    def active?
      !expired?
    end
    
    def mark_as_paid!(paid_at: Time.current, xendit_action_id: nil)
      update!(
        status: "paid",
        paid_at: paid_at,
        xendit_action_id: xendit_action_id || self.xendit_action_id
      )
    end
  end
end
```

#### `Finance::SpaceSubscription`
- Add association:
  ```ruby
  has_many :billing_cycles,
           class_name: "Finance::BillingCycle",
           foreign_key: :space_subscription_id,
           dependent: :destroy
  ```

- Add `current_paid_cycle` method:
  ```ruby
  def current_paid_cycle
    billing_cycles.paid_and_active.order(cycle_number: :desc).first
  end
  ```

- Add `in_grace_period?` method:
  ```ruby
  def in_grace_period?
    return false if active? # Active subscriptions don't need grace period
    current_paid_cycle.present?
  end
  ```

- Add `effective_token_limit` method:
  ```ruby
  def effective_token_limit
    if active?
      # Active subscription: FREE_TOKENS + subscription plan tokens
      Spaces::Space::FREE_TOKENS + subscription_plan.token_limit
    elsif in_grace_period?
      # Grace period: FREE_TOKENS + billing cycle allocated tokens
      paid_cycle = current_paid_cycle
      return nil unless paid_cycle
      Spaces::Space::FREE_TOKENS + paid_cycle.tokens_allocated
    else
      nil
    end
  end
  ```

#### `Spaces::Space`
- Rename constant:
  ```ruby
  FREE_TOKENS = 30  # Changed from SPACE_TOKEN_LIMIT
  ```

- Update `current_token_limit`:
  ```ruby
  def current_token_limit
    subscription = space_subscription
    
    # Check active subscription first
    if subscription&.active?
      # Active subscription: FREE_TOKENS + subscription plan tokens
      return FREE_TOKENS + subscription.subscription_plan.token_limit
    end
    
    # Check grace period for inactive subscriptions (paid cycle that hasn't expired)
    if subscription&.in_grace_period?
      # Grace period: FREE_TOKENS + billing cycle allocated tokens
      paid_cycle = subscription.current_paid_cycle
      return FREE_TOKENS + paid_cycle.tokens_allocated if paid_cycle
    end
    
    # Default: just free tokens
    FREE_TOKENS
  end
  ```

- Update `can_ai?` (already uses `current_token_limit`, so should work automatically)

### 3. Operation Updates

#### New Operation: `CreateBillingCycle`
```ruby
module Finance
  module Operations
    module Subscriptions
      class CreateBillingCycle < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_subscription_id).value(:string)
            optional(:cycle_number).maybe(:integer)
            optional(:started_at).maybe(:date_time)
            optional(:cycle).maybe(:hash)
            optional(:xendit_cycle_id).maybe(:string)
            optional(:xendit_action_id).maybe(:string)
            optional(:metadata).maybe(:hash)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          space_subscription = step find_space_subscription(params:)
          cycle_data = step extract_cycle_data(params:, space_subscription:)
          billing_cycle = step create_billing_cycle(space_subscription:, cycle_data:)
          
          billing_cycle
        end
        
        private
        
        def extract_cycle_data(params:, space_subscription:)
          cycle_number = params[:cycle_number] || params.dig(:cycle, :recurrence_number)
          cycle_start = params[:started_at] || params.dig(:cycle, :charged_at) || Time.current
          
          # Extract Xendit IDs - try multiple possible locations in the payload
          xendit_cycle_id = params.dig(:cycle, :id) ||
                           params.dig(:cycle_id) ||
                           params[:xendit_cycle_id]
          
          xendit_action_id = params.dig(:action, :id) ||
                            params.dig(:action_id) ||
                            params[:xendit_action_id]
          
          # Calculate cycle end using Utils::Recurrence based on subscription plan interval
          plan = space_subscription.subscription_plan
          repeat_interval = plan.interval == "year" ? "every_year" : "every_month"
          
          schedule = Utils::Recurrence.schedule(
            repeat_interval: repeat_interval,
            date: cycle_start
          )
          cycle_end = (cycle_start + 1.send(plan.interval)).end_of_day
          
          Success({
            cycle_number: cycle_number,
            started_at: cycle_start,
            ends_at: cycle_end,
            tokens_allocated: plan.token_limit, # This is the subscription tokens (FREE_TOKENS added separately)
            xendit_cycle_id: xendit_cycle_id,
            xendit_action_id: xendit_action_id,
            metadata: params[:metadata] || params[:data] || {}
          })
        end
        
        def create_billing_cycle(space_subscription:, cycle_data:)
          # Try to find by xendit_cycle_id first if available, then by cycle_number
          billing_cycle = if cycle_data[:xendit_cycle_id].present?
                           space_subscription.billing_cycles.find_or_initialize_by(
                             xendit_cycle_id: cycle_data[:xendit_cycle_id]
                           )
                         else
                           space_subscription.billing_cycles.find_or_initialize_by(
                             cycle_number: cycle_data[:cycle_number]
                           )
                         end
          
          billing_cycle.assign_attributes(
            cycle_number: cycle_data[:cycle_number] || billing_cycle.cycle_number,
            started_at: cycle_data[:started_at],
            ends_at: cycle_data[:ends_at],
            tokens_allocated: cycle_data[:tokens_allocated],
            xendit_cycle_id: cycle_data[:xendit_cycle_id] || billing_cycle.xendit_cycle_id,
            metadata: cycle_data[:metadata],
            status: "pending"
          )
          
          billing_cycle.save!
          Success(billing_cycle)
        end
      end
    end
  end
end
```

#### `CancelSubscription` Operation
- Set `cancelled_at` when cancellation is requested
- Don't modify billing cycles (they remain valid until they expire)
- Set `ended_at` to current time (grace period is handled by checking paid cycles)

**Updated flow:**
```ruby
def update_space_subscription(space_subscription:, xendit_response:)
  space_subscription.update!(
    status: "inactive",
    cancelled_at: Time.current,
    ended_at: Time.current,
    metadata: space_subscription.metadata.merge(xendit_response)
  )
  
  Success(space_subscription)
end
```

#### `HandleWebhook` Operation (Main Router)
- Routes to specific webhook handler operations based on event type
- Keeps routing logic only, delegates to webhook namespace operations

**Updated structure:**
```ruby
def route_webhook_event(event:, data:)
  case event
  when "recurring.plan.activation", "recurring.plan.activated"
    Webhook::HandlePlanActivated.new.call(data)
  when "recurring.plan.inactivation", "recurring.plan.inactivated"
    Webhook::HandlePlanInactivated.new.call(data)
  when "recurring.cycle.created"
    Webhook::HandleCycleCreated.new.call(data)
  when "recurring.cycle.retrying"
    Webhook::HandleCycleRetrying.new.call(data)
  when "recurring.cycle.succeeded"
    Webhook::HandleCycleSucceeded.new.call(data)
  when "recurring.cycle.failed"
    Webhook::HandleCycleFailed.new.call(data)
  else
    Failure(event: "Unknown webhook event: #{event}")
  end
end
```

#### Webhook Handler Operations (New Namespace: `Finance::Operations::Subscriptions::Webhook`)

Each handler is a separate operation with clear steps:

**1. `HandlePlanActivated`**
```ruby
module Finance
  module Operations
    module Subscriptions
      module Webhook
        class HandlePlanActivated < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:id).value(:string)
              optional(:status).value(:string)
              optional(:reference_id).value(:string)
              optional(:schedule).hash do
                optional(:reference_id).value(:string)
              end
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            update_attrs = step build_update_attributes(params:, space_subscription:)
            _ = step update_subscription(space_subscription:, update_attrs:)
            
            { message: "Plan activated", subscription_id: space_subscription.id }
          end
          
          private
          
          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(params:)
          end
          
          def build_update_attributes(params:, space_subscription:)
            attrs = {
              status: "active",
              started_at: Time.current,
              metadata: space_subscription.metadata.merge(params)
            }
            
            attrs[:xendit_reference_id] = params[:reference_id] if params[:reference_id].present?
            if params.dig(:schedule, :reference_id).present?
              attrs[:xendit_schedule_reference_id] = params.dig(:schedule, :reference_id)
            end
            
            Success(attrs)
          end
          
          def update_subscription(space_subscription:, update_attrs:)
            space_subscription.update!(update_attrs)
            Success(space_subscription)
          end
        end
      end
    end
  end
end
```

**2. `HandlePlanInactivated`**
```ruby
module Finance
  module Operations
    module Subscriptions
      module Webhook
        class HandlePlanInactivated < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:id).value(:string)
              optional(:status).value(:string)
              optional(:reference_id).value(:string)
              optional(:schedule).hash do
                optional(:reference_id).value(:string)
              end
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            update_attrs = step build_update_attributes(params:, space_subscription:)
            _ = step update_subscription(space_subscription:, update_attrs:)
            
            { message: "Plan inactivated", subscription_id: space_subscription.id }
          end
          
          private
          
          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(params:)
          end
          
          def build_update_attributes(params:, space_subscription:)
            attrs = {
              status: "inactive",
              ended_at: Time.current,
              metadata: space_subscription.metadata.merge(params)
            }
            
            attrs[:xendit_reference_id] = params[:reference_id] if params[:reference_id].present?
            if params.dig(:schedule, :reference_id).present?
              attrs[:xendit_schedule_reference_id] = params.dig(:schedule, :reference_id)
            end
            
            Success(attrs)
          end
          
          def update_subscription(space_subscription:, update_attrs:)
            space_subscription.update!(update_attrs)
            Success(space_subscription)
          end
        end
      end
    end
  end
end
```

**3. `HandleCycleCreated`**
```ruby
module Finance
  module Operations
    module Subscriptions
      module Webhook
        class HandleCycleCreated < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan).hash do
                required(:id).value(:string)
              end
              optional(:cycle).hash do
                optional(:id).value(:string)
                optional(:recurrence_number).value(:integer)
                optional(:charged_at).value(:string)
              end
              optional(:plan_id).value(:string)
              optional(:id).value(:string)
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            billing_cycle = step create_billing_cycle(space_subscription:, params:)
            _ = step update_subscription_cycle_count(space_subscription:, params:)
            _ = step update_subscription_metadata(space_subscription:, params:)
            
            { message: "Cycle created", billing_cycle_id: billing_cycle.id }
          end
          
          private
          
          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(params:)
          end
          
          def create_billing_cycle(space_subscription:, params:)
            CreateBillingCycle.new.call(
              space_subscription_id: space_subscription.id,
              cycle_number: params.dig(:cycle, :recurrence_number),
              started_at: params.dig(:cycle, :charged_at) || Time.current,
              cycle: params[:cycle],
              xendit_cycle_id: params.dig(:cycle, :id) || params[:cycle_id],
              metadata: params
            )
          end
          
          def update_subscription_cycle_count(space_subscription:, params:)
            cycle_number = params.dig(:cycle, :recurrence_number)
            return Success(true) unless cycle_number.present?
            
            space_subscription.update!(current_cycle_count: cycle_number)
            Success(true)
          end
          
          def update_subscription_metadata(space_subscription:, params:)
            space_subscription.update!(
              metadata: space_subscription.metadata.merge(cycle_data: params)
            )
            Success(true)
          end
        end
      end
    end
  end
end
```

**4. `HandleCycleSucceeded`**
```ruby
module Finance
  module Operations
    module Subscriptions
      module Webhook
        class HandleCycleSucceeded < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan).hash do
                required(:id).value(:string)
              end
              required(:action).hash do
                required(:id).value(:string)
                optional(:amount).value(:decimal)
                optional(:currency).value(:string)
                optional(:status).value(:string)
                optional(:payment_method).hash do
                  optional(:id).value(:string)
                  optional(:type).value(:string)
                end
              end
              optional(:cycle).hash do
                optional(:id).value(:string)
                optional(:recurrence_number).value(:integer)
                optional(:charged_at).value(:string)
              end
              optional(:action_id).value(:string)
              optional(:cycle_id).value(:string)
              optional(:xendit_action_id).value(:string)
              optional(:xendit_cycle_id).value(:string)
              optional(:plan_id).value(:string)
              optional(:id).value(:string)
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            xendit_ids = step extract_xendit_ids(params:)
            payment = step find_or_create_payment(
              space_subscription:,
              xendit_ids:,
              params:
            )
            billing_cycle = step find_or_create_billing_cycle(
              space_subscription:,
              xendit_ids:,
              params:,
              payment:
            )
            _ = step mark_billing_cycle_as_paid(billing_cycle:, payment:, xendit_ids:)
            _ = step update_payment_as_succeeded(payment:, params:)
            
            {
              message: "Cycle succeeded",
              billing_cycle_id: billing_cycle.id,
              payment_id: payment.id
            }
          end
          
          private
          
          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(params:)
          end
          
          def extract_xendit_ids(params:)
            ExtractXenditIds.new.call(params:)
          end
          
          def find_or_create_payment(space_subscription:, xendit_ids:, params:)
            FindOrCreatePayment.new.call(
              space_subscription:,
              xendit_action_id: xendit_ids[:xendit_action_id],
              **params
            )
          end
          
          def find_or_create_billing_cycle(space_subscription:, xendit_ids:, params:, payment:)
            FindOrCreateBillingCycle.new.call(
              space_subscription:,
              xendit_cycle_id: xendit_ids[:xendit_cycle_id],
              cycle_number: params.dig(:cycle, :recurrence_number),
              started_at: params.dig(:cycle, :charged_at) || payment.paid_at || Time.current,
              cycle: params[:cycle],
              metadata: params
            )
          end
          
          def mark_billing_cycle_as_paid(billing_cycle:, payment:, xendit_ids:)
            billing_cycle.mark_as_paid!(
              paid_at: payment.paid_at || Time.current,
              xendit_action_id: xendit_ids[:xendit_action_id]
            )
            Success(billing_cycle)
          end
          
          def update_payment_as_succeeded(payment:, params:)
            payment.update!(
              status: "succeeded",
              paid_at: Time.current,
              xendit_data: params,
              metadata: payment.metadata.merge(cycle_data: params)
            )
            Success(payment)
          end
        end
      end
    end
  end
end
```

**5. `HandleCycleFailed`**
```ruby
module Finance
  module Operations
    module Subscriptions
      module Webhook
        class HandleCycleFailed < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan).hash do
                required(:id).value(:string)
              end
              optional(:action).hash do
                optional(:id).value(:string)
                optional(:amount).value(:decimal)
                optional(:currency).value(:string)
                optional(:status).value(:string)
              end
              optional(:cycle).hash do
                optional(:id).value(:string)
                optional(:recurrence_number).value(:integer)
                optional(:charged_at).value(:string)
              end
              optional(:action_id).value(:string)
              optional(:cycle_id).value(:string)
              optional(:xendit_action_id).value(:string)
              optional(:xendit_cycle_id).value(:string)
              optional(:plan_id).value(:string)
              optional(:id).value(:string)
              optional(:status).value(:string)
              optional(:failure_reason).value(:string)
              optional(:error).hash do
                optional(:message).value(:string)
              end
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            xendit_ids = step extract_xendit_ids(params:)
            
            if xendit_ids[:xendit_action_id].present?
              payment = step find_or_create_payment(
                space_subscription:,
                xendit_ids:,
                params:
              )
              _ = step mark_payment_as_failed(payment:, params:)
            end
            
            billing_cycle = step find_or_create_billing_cycle(
              space_subscription:,
              xendit_ids:,
              params:,
              payment: payment || nil
            )
            _ = step mark_billing_cycle_as_failed(billing_cycle:) if billing_cycle.present?
            _ = step update_subscription_metadata(space_subscription:, params:)
            
            { message: "Cycle failed", subscription_id: space_subscription.id }
          end
          
          private
          
          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(params:)
          end
          
          def extract_xendit_ids(params:)
            ExtractXenditIds.new.call(params:)
          end
          
          def find_or_create_payment(space_subscription:, xendit_ids:, params:)
            FindOrCreatePayment.new.call(
              space_subscription:,
              xendit_action_id: xendit_ids[:xendit_action_id],
              **params
            )
          end
          
          def mark_payment_as_failed(payment:, params:)
            payment.update!(
              status: "failed",
              failed_at: Time.current,
              failure_reason: params.dig(:failure_reason) || params.dig(:error, :message) || "Payment failed",
              xendit_data: params,
              metadata: payment.metadata.merge(cycle_data: params)
            )
            Success(payment)
          end
          
          def find_or_create_billing_cycle(space_subscription:, xendit_ids:, params:, payment:)
            return Success(nil) unless xendit_ids[:xendit_cycle_id].present? || params.dig(:cycle, :recurrence_number).present?
            
            FindOrCreateBillingCycle.new.call(
              space_subscription:,
              xendit_cycle_id: xendit_ids[:xendit_cycle_id],
              cycle_number: params.dig(:cycle, :recurrence_number),
              started_at: params.dig(:cycle, :charged_at) || payment&.failed_at || Time.current,
              cycle: params[:cycle],
              metadata: params
            )
          end
          
          def mark_billing_cycle_as_failed(billing_cycle:)
            billing_cycle.update!(status: "failed")
            Success(billing_cycle)
          end
          
          def update_subscription_metadata(space_subscription:, params:)
            space_subscription.update!(
              metadata: space_subscription.metadata.merge(cycle_failed_data: params)
            )
            Success(true)
          end
        end
      end
    end
  end
end
```

**6. `HandleCycleRetrying`**
```ruby
module Finance
  module Operations
    module Subscriptions
      module Webhook
        class HandleCycleRetrying < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan).hash do
                required(:id).value(:string)
              end
              optional(:cycle).hash do
                optional(:id).value(:string)
                optional(:recurrence_number).value(:integer)
              end
              optional(:status).value(:string)
              optional(:plan_id).value(:string)
              optional(:id).value(:string)
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            _ = step update_subscription_metadata(space_subscription:, params:)
            
            { message: "Cycle retrying", subscription_id: space_subscription.id }
          end
          
          private
          
          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(params:)
          end
          
          def update_subscription_metadata(space_subscription:, params:)
            space_subscription.update!(
              metadata: space_subscription.metadata.merge(cycle_retry_data: params)
            )
            Success(true)
          end
        end
      end
    end
  end
end
```

#### Supporting Operations (Reusable Steps)

**1. `FindSpaceSubscriptionByXenditId`**
```ruby
module Finance
  module Operations
    module Subscriptions
      class FindSpaceSubscriptionByXenditId < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            optional(:plan).hash do
              optional(:id).value(:string)
            end
            optional(:plan_id).value(:string)
            optional(:id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          plan_id = step extract_plan_id(params:)
          space_subscription = step find_subscription(plan_id:)
          
          space_subscription
        end
        
        private
        
        def extract_plan_id(params:)
          plan_id = params.dig(:plan, :id) || params[:plan_id] || params[:id]
          return Failure(plan_id: "missing") unless plan_id.present?
          
          Success(plan_id)
        end
        
        def find_subscription(plan_id:)
          space_subscription = Finance::SpaceSubscription.find_by(xendit_plan_id: plan_id)
          return Failure(space_subscription: "not found for plan_id: #{plan_id}") unless space_subscription
          
          Success(space_subscription)
        end
      end
    end
  end
end
```

**2. `ExtractXenditIds`**
```ruby
module Finance
  module Operations
    module Subscriptions
      class ExtractXenditIds < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            optional(:cycle).hash do
              optional(:id).value(:string)
            end
            optional(:action).hash do
              optional(:id).value(:string)
            end
            optional(:cycle_id).value(:string)
            optional(:action_id).value(:string)
            optional(:xendit_cycle_id).value(:string)
            optional(:xendit_action_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          xendit_ids = step extract_ids(params:)
          
          xendit_ids
        end
        
        private
        
        def extract_ids(params:)
          xendit_cycle_id = params.dig(:cycle, :id) ||
                           params[:cycle_id] ||
                           params[:xendit_cycle_id]
          
          xendit_action_id = params.dig(:action, :id) ||
                            params[:action_id] ||
                            params[:xendit_action_id]
          
          Success({
            xendit_cycle_id: xendit_cycle_id,
            xendit_action_id: xendit_action_id
          })
        end
      end
    end
  end
end
```

**3. `FindOrCreatePayment`** (Extract from current `handle_webhook.rb`)
```ruby
module Finance
  module Operations
    module Subscriptions
      class FindOrCreatePayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_subscription).value(type?: Finance::SpaceSubscription)
            required(:xendit_action_id).value(:string)
            optional(:action).hash do
              optional(:id).value(:string)
              optional(:amount).value(:decimal)
              optional(:currency).value(:string)
              optional(:reference_id).value(:string)
              optional(:payment_method).hash do
                optional(:id).value(:string)
                optional(:type).value(:string)
              end
            end
            optional(:cycle).hash do
              optional(:id).value(:string)
              optional(:reference_id).value(:string)
            end
            optional(:amount).value(:decimal)
            optional(:currency).value(:string)
            optional(:reference_id).value(:string)
            optional(:action_id).value(:string)
            optional(:cycle_id).value(:string)
            optional(:payment_method_id).value(:string)
            optional(:payment_method_type).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          space_subscription = step find_space_subscription(params:)
          xendit_action_id = step extract_action_id(params:)
          payment = step find_or_initialize_payment(
            space_subscription:,
            xendit_action_id:
          )
          _ = step assign_payment_attributes(payment:, space_subscription:, params:) if payment.new_record?
          _ = step save_payment(payment:)
          
          payment
        end
        
        private
        
        def find_space_subscription(params:)
          Success(params[:space_subscription])
        end
        
        def extract_action_id(params:)
          action_id = params[:xendit_action_id]
          return Failure(action_id: "missing") unless action_id.present?
          
          Success(action_id)
        end
        
        def find_or_initialize_payment(space_subscription:, xendit_action_id:)
          payment = Finance::Payment.find_or_initialize_by(
            xendit_action_id: xendit_action_id
          )
          Success(payment)
        end
        
        def assign_payment_attributes(payment:, space_subscription:, params:)
          amount_cents = params.dig(:action, :amount) ||
                        params[:amount] ||
                        space_subscription.subscription_plan.price_cents
          
          reference_id = params.dig(:action, :reference_id) ||
                        params[:reference_id] ||
                        params.dig(:cycle, :reference_id)
          
          payment.assign_attributes(
            space_subscription: space_subscription,
            xendit_action_id: params[:xendit_action_id],
            xendit_cycle_id: params.dig(:cycle, :id) || params[:cycle_id],
            xendit_reference_id: reference_id,
            amount_cents: amount_cents,
            amount_currency: params.dig(:action, :currency) || params[:currency] || "PHP",
            status: "pending",
            payment_method_type: params.dig(:action, :payment_method, :type) || params[:payment_method_type],
            payment_method_id: params.dig(:action, :payment_method, :id) || params[:payment_method_id],
            xendit_data: params,
            metadata: {}
          )
          
          Success(payment)
        end
        
        def save_payment(payment:)
          payment.save!
          Success(payment)
        rescue ActiveRecord::RecordInvalid => e
          Failure(payment: e.record.errors.full_messages)
        end
      end
    end
  end
end
```

**4. `FindOrCreateBillingCycle`**
```ruby
module Finance
  module Operations
    module Subscriptions
        class FindOrCreateBillingCycle < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_subscription).value(type?: Finance::SpaceSubscription)
            optional(:xendit_cycle_id).maybe(:string)
            optional(:cycle_number).maybe(:integer)
            optional(:started_at).maybe(:date_time)
            optional(:cycle).hash do
              optional(:id).value(:string)
              optional(:recurrence_number).value(:integer)
              optional(:charged_at).value(:string)
              optional(:reference_id).value(:string)
            end
            optional(:cycle_id).value(:string)
            optional(:metadata).maybe(:hash)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          space_subscription = step find_space_subscription(params:)
          billing_cycle = step find_existing_cycle(space_subscription:, params:)
          
          if billing_cycle.present?
            _ = step update_existing_cycle(billing_cycle:, params:)
            billing_cycle
          else
            CreateBillingCycle.new.call(
              space_subscription_id: space_subscription.id,
              cycle_number: params[:cycle_number],
              started_at: params[:started_at],
              cycle: params[:cycle],
              xendit_cycle_id: params[:xendit_cycle_id],
              metadata: params[:metadata] || {}
            )
          end
        end
        
        private
        
        def find_space_subscription(params:)
          Success(params[:space_subscription])
        end
        
        def find_existing_cycle(space_subscription:, params:)
          # Try to find by xendit_cycle_id first, then by cycle_number
          if params[:xendit_cycle_id].present?
            cycle = space_subscription.billing_cycles.find_by(
              xendit_cycle_id: params[:xendit_cycle_id]
            )
            return Success(cycle) if cycle.present?
          end
          
          if params[:cycle_number].present?
            cycle = space_subscription.billing_cycles.find_by(
              cycle_number: params[:cycle_number]
            )
            return Success(cycle) if cycle.present?
          end
          
          Success(nil)
        end
        
        def update_existing_cycle(billing_cycle:, params:)
          updates = {}
          updates[:xendit_cycle_id] = params[:xendit_cycle_id] if params[:xendit_cycle_id].present? && billing_cycle.xendit_cycle_id.blank?
          
          billing_cycle.update!(updates) if updates.present?
          Success(billing_cycle)
        end
      end
    end
  end
end
```

**Note:** The old long handler methods have been replaced with dedicated webhook handler operations. The `HandleWebhook` operation now simply routes to these operations:

- `Webhook::HandlePlanActivated.new.call(data:)`
- `Webhook::HandlePlanInactivated.new.call(data:)`
- `Webhook::HandleCycleCreated.new.call(data:)`
- `Webhook::HandleCycleSucceeded.new.call(data:)`
- `Webhook::HandleCycleFailed.new.call(data:)`
- `Webhook::HandleCycleRetrying.new.call(data:)`

Each handler is a separate operation with clear steps and contracts, following Single Responsibility Principle.

### 4. Query Updates

#### `Ai::Queries::Usages::UsageInPeriod`
- May need to consider grace period when calculating usage limits
- Currently tracks usage in a period, should work as-is

### 5. Serializer Updates

#### `Finance::SpaceSubscriptionSerializer`
- Add `cancelled_at`, `current_cycle_ends_at`, `grace_period_ends_at` fields
- Add `in_grace_period` boolean field

## Implementation Steps

1. **Create Migration**
   - Create `finance_billing_cycles` table with all required fields
   - Add `cancelled_at` to `finance_space_subscriptions` table
   - Add indexes for performance

2. **Update Models**
   - Create `Finance::BillingCycle` model with all methods
   - Add `billing_cycles` association to `Finance::SpaceSubscription`
   - Add methods to `Finance::SpaceSubscription` (`current_paid_cycle`, `in_grace_period?`, `effective_token_limit`)
   - **Rename `SPACE_TOKEN_LIMIT` to `FREE_TOKENS` in `Spaces::Space`**
   - Update `Spaces::Space.current_token_limit` to:
     - Add `FREE_TOKENS` to subscription limits
     - Use `billing_cycle.tokens_allocated` for grace period

3. **Update Operations**
   - Create `CreateBillingCycle` operation
   - Modify `CancelSubscription` to set `cancelled_at`
   - Modify `HandleWebhook` to:
     - Create billing cycles on `recurring.cycle.created`
     - Mark cycles as paid on `recurring.cycle.succeeded`
     - Mark cycles as failed on `recurring.cycle.failed`
     - Extract `xendit_cycle_id` and `xendit_action_id` from webhook data

4. **Update Serializers**
   - Add `billing_cycles` to `Finance::SpaceSubscriptionSerializer` (optional)
   - Add `cancelled_at` to subscription serializer

5. **Update Tests**
   - Update `spec/models/spaces/space_spec.rb` to test `FREE_TOKENS` constant
   - Update `current_token_limit` tests to account for `FREE_TOKENS` addition
   - Test billing cycle creation and payment marking
   - Test grace period logic with `billing_cycle.tokens_allocated`

6. **Testing Scenarios**
   - Test cancellation with active subscription
   - Test token access during grace period (should use `billing_cycle.tokens_allocated + FREE_TOKENS`)
   - Test token access after grace period expires (should drop to `FREE_TOKENS`)
   - Test with different billing cycle intervals
   - Test that `FREE_TOKENS` is always included in limits

## Edge Cases to Consider

1. **Subscription cancelled before first payment**
   - No paid cycles exist
   - `in_grace_period?` returns false
   - Token limit drops to `FREE_TOKENS` (30) immediately

2. **Subscription cancelled mid-cycle (cycle already paid)**
   - Paid cycle exists and hasn't expired
   - `in_grace_period?` returns true
   - User retains tokens until `cycle.ends_at`

3. **Subscription cancelled, payment arrives later**
   - Cycle is created when webhook arrives
   - Cycle marked as paid when payment succeeds
   - Grace period becomes active automatically

4. **Multiple cycles paid, subscription cancelled**
   - Only the most recent paid cycle that hasn't expired is considered
   - `current_paid_cycle` returns the latest paid active cycle

5. **Cycle expires after cancellation**
   - `in_grace_period?` returns false once cycle expires
   - Token limit drops to `FREE_TOKENS` (30)

6. **Payment failed but subscription still active**
   - Failed cycles don't grant token access
   - Only paid cycles provide tokens
   - Active subscriptions with failed payments handled separately

## Benefits of This Approach

1. **Precise Tracking**: Each billing cycle is tracked separately with clear start/end dates
2. **Uses Existing Utilities**: Leverages `Utils::Recurrence` for cycle period calculation
3. **Simple Grace Period Logic**: Just check if there's a paid cycle that hasn't expired
4. **Automatic Expiration**: Tokens expire when cycle ends, no manual calculation needed
5. **Payment Tracking**: Clear link between payments and billing cycles
6. **Flexible**: Works with monthly, yearly, or any interval subscriptions
7. **Uses Billing Cycle Tokens**: `billing_cycle.tokens_allocated` is used instead of `subscription_plan.token_limit` because:
   - It reflects the actual tokens allocated for that specific cycle
   - If subscription plan changes, existing cycles keep their original allocation
   - More accurate for historical tracking
   - Not difficult to implement - we already store it when creating the cycle
8. **Free Tokens Always Included**: `FREE_TOKENS` (30) is added to all token limits:
   - Free users: 30 tokens
   - Active subscription: 30 + subscription plan tokens
   - Grace period: 30 + billing cycle allocated tokens

## Questions to Clarify

1. Should grace period apply if subscription was cancelled before any successful payment?
   - **Answer**: No, only paid cycles grant token access

2. What if user resubscribes during grace period?
   - **Answer**: New subscription starts, old cycles remain but new active subscription takes precedence

3. Should we track which billing cycle tokens belong to in `ai_usages`?
   - **Answer**: Optional enhancement for more precise usage tracking per cycle, but not required for MVP

4. How to handle subscriptions with different billing intervals (monthly vs yearly)?
   - **Answer**: `Utils::Recurrence` handles this automatically based on subscription plan interval

