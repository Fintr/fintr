# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class GetCurrentSubscriptions < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params         = step validate(params:)
          space          = step find_space(params:)
          subscriptions  = step find_subscriptions(space:)

          subscriptions
        end

        private

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def find_subscriptions(space:)
          # Return all subscriptions that are:
          # - Active, pending, or requires_action (regardless of paid billing cycles)
          # - OR inactive but have billing cycles (paid or not)
          # This ensures subscriptions without paid billing cycles still show in the frontend
          subscriptions = Finance::SpaceSubscription
                          .for_space(space.id)
                          .order(created_at: :desc)
                          .select { |sub| !sub.inactive? || (sub.inactive? && sub.billing_cycles.any?) }

          Success(subscriptions.to_a)
        end
      end
    end
  end
end
