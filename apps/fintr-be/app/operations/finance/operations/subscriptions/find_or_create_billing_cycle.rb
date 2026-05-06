# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class FindOrCreateBillingCycle < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_subscription).value(type?: Finance::SpaceSubscription)
            optional(:xendit_cycle_id).maybe(:string)
            optional(:cycle_number).maybe(:float)
            optional(:started_at).maybe(:date_time)
            optional(:cycle).hash do
              optional(:id).maybe(:string)
              optional(:recurrence_number).value(:integer)
              optional(:charged_at).maybe(:string)
              optional(:reference_id).maybe(:string)
            end
            optional(:cycle_id).maybe(:string)
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
          billing_cycle       = step find_existing_cycle(space_subscription:, params:)

          if billing_cycle.present?
            _                 = step update_existing_cycle(billing_cycle:, params:)
            return billing_cycle
          end

          step create_new_cycle(space_subscription:, params:)
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
          updates[:metadata] = billing_cycle.metadata.merge(params[:metadata] || {}) if params[:metadata].present?
          updates[:scheduled_timestamp] = params[:scheduled_timestamp] if params[:scheduled_timestamp].present? && billing_cycle.scheduled_timestamp.blank?

          billing_cycle.update!(updates) if updates.any?
          Success(billing_cycle)
        rescue ActiveRecord::RecordInvalid => e
          Failure(billing_cycle: e.record.errors.full_messages)
        end

        def create_new_cycle(space_subscription:, params:)
          CreateBillingCycle.new.call(
            space_subscription_id: space_subscription.id,
            cycle_number: params[:cycle_number],
            started_at: params[:started_at],
            cycle: params[:cycle],
            xendit_cycle_id: params[:xendit_cycle_id],
            scheduled_timestamp: params[:scheduled_timestamp],
            metadata: params[:metadata] || {}
          )
        end
      end
    end
  end
end
