# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class CreateBillingCycle < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_subscription_id).value(:string)
            required(:cycle_number).value(:float)
            required(:started_at).value(:date_time)
            optional(:cycle).maybe(:hash)
            optional(:xendit_cycle_id).maybe(:string)
            optional(:metadata).maybe(:hash)
            optional(:scheduled_timestamp).maybe(:date_time)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          space_subscription  = step find_space_subscription(params:)
          cycle_data          = step extract_cycle_data(params:, space_subscription:)
          billing_cycle       = step create_billing_cycle(space_subscription:, cycle_data:)

          billing_cycle
        end

        private

        def find_space_subscription(params:)
          space_subscription = Finance::SpaceSubscription.find_by(id: params[:space_subscription_id])
          return Failure(space_subscription_id: "not found") unless space_subscription

          Success(space_subscription)
        end

        def extract_cycle_data(params:, space_subscription:)
          # Extract cycle_number from flat structure or nested structure
          cycle_number = params[:cycle_number] || params.dig(:cycle, :recurrence_number)

          # Extract started_at - can be passed directly or extracted from cycle hash
          cycle_start = params[:started_at]
          cycle_start = cycle_start.beginning_of_day

          # Extract Xendit IDs - try multiple possible locations in the payload
          # For flat structure (recurring.cycle.* events), cycle ID is in params[:id] or params[:xendit_cycle_id]
          # For nested structure, it's in params[:cycle][:id]
          xendit_cycle_id = params[:xendit_cycle_id] || # Passed directly
                           params[:id] || # Cycle ID in flat structure
                           params.dig(:cycle, :id) ||
                           params[:cycle_id]

          # Calculate cycle end based on subscription plan interval
          plan = space_subscription.subscription_plan
          cycle_end = (cycle_start + 1.send(plan.interval) - 1.day).end_of_day

          # Create tstzrange span as a Ruby Range
          # ActiveRecord will convert this to PostgreSQL tstzrange
          # The range is inclusive on both ends: [start, end]
          span = (cycle_start..cycle_end)

          Success({
            cycle_number: cycle_number,
            span: span,
            tokens_allocated: plan.token_limit, # This is the subscription tokens (FREE_TOKENS added separately)
            xendit_cycle_id: xendit_cycle_id,
            scheduled_timestamp: params[:scheduled_timestamp],
            metadata: params[:metadata] || {}
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
            span: cycle_data[:span],
            tokens_allocated: cycle_data[:tokens_allocated],
            xendit_cycle_id: cycle_data[:xendit_cycle_id] || billing_cycle.xendit_cycle_id,
            metadata: cycle_data[:metadata],
            scheduled_timestamp: cycle_data[:scheduled_timestamp] || billing_cycle.scheduled_timestamp,
            status: "pending"
          )

          billing_cycle.save!
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
