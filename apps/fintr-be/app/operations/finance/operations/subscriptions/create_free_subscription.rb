# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class CreateFreeSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:subscription_plan_id).value(:string)
            required(:granted_by).value(:string)
            optional(:notes).maybe(:string)
            optional(:anchor_date).maybe(:time)
          end
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          space               = step find_space(params:)
          _                   = step validate_no_active_subscription(space:)
          subscription_plan   = step find_subscription_plan(params:)
          anchor_date         = step resolve_anchor_date(params:)
          space_subscription  = step create_free_subscription(
                                        space:,
                                        subscription_plan:,
                                        params:,
                                        anchor_date:
                                      )
          _billing_cycle      = step create_initial_billing_cycle(
                                        space_subscription:,
                                        subscription_plan:,
                                        anchor_date:
                                      )

          space_subscription.reload
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def validate_no_active_subscription(space:)
          blocking_statuses = %w[active pending requires_action]
          existing_subscription = Finance::SpaceSubscription
            .where(space_id: space.id, status: blocking_statuses)
            .first
          return Failure(subscription: "Space already has an active subscription. Please cancel it first.") if existing_subscription

          Success(true)
        end

        def find_subscription_plan(params:)
          plan = Finance::SubscriptionPlan.find_by(id: params[:subscription_plan_id])
          return Failure(subscription_plan_id: "not found") unless plan

          Success(plan)
        end

        def resolve_anchor_date(params:)
          anchor_date = params[:anchor_date] || Time.zone.now
          Success(anchor_date)
        end

        def create_free_subscription(space:, subscription_plan:, params:, anchor_date:)
          metadata = {
            granted_by: params[:granted_by],
            granted_at: Time.zone.now.iso8601,
            notes: params[:notes],
            space_name: space.name,
            space_type: space.type,
            is_free_subscription: true
          }

          space_subscription = Finance::SpaceSubscription.create!(
            space: space,
            subscription_plan: subscription_plan,
            subscription_type: "free",
            status: "active",
            started_at: anchor_date,
            metadata: metadata,
            # Leave Xendit fields nil for free subscriptions
            xendit_plan_id: nil,
            xendit_reference_id: nil,
            xendit_customer_id: nil,
            xendit_customer_reference_id: nil,
            xendit_schedule_id: nil,
            xendit_schedule_reference_id: nil,
            sponsor_code_id: nil
          )

          Success(space_subscription)
        rescue ActiveRecord::RecordInvalid => e
          Failure(space_subscription: e.record.errors.full_messages)
        rescue StandardError => e
          Failure(error: "Failed to create free subscription: #{e.message}")
        end

        def create_initial_billing_cycle(space_subscription:, subscription_plan:, anchor_date:)
          # Calculate cycle end based on plan interval
          cycle_end = if subscription_plan.interval == "month"
            anchor_date + 1.month
          else
            anchor_date + 1.year
          end

          billing_cycle = Finance::BillingCycle.create!(
            space_subscription: space_subscription,
            cycle_number: 1.0,
            span: (anchor_date..cycle_end),
            status: "paid",
            tokens_allocated: subscription_plan.token_limit,
            paid_at: Time.zone.now,
            xendit_cycle_id: nil,
            metadata: {
              free_subscription: true,
              created_at: Time.zone.now.iso8601
            }
          )

          Success(billing_cycle)
        rescue ActiveRecord::RecordInvalid => e
          Failure(billing_cycle: e.record.errors.full_messages)
        rescue StandardError => e
          Failure(error: "Failed to create billing cycle: #{e.message}")
        end
      end
    end
  end
end
