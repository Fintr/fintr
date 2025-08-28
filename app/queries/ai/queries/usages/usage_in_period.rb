# frozen_string_literal: true

module Ai
  module Queries
    module Usages
      class UsageInPeriod < Dry::Operation
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

        def call(params:, relation: Ai::Usage.all)
          params = step validate(params:)
          space = step find_space(params:)
          usage_period = step find_usage_period(space:)
          step find_usages(relation:, space:, usage_period:)
        end

        private

        def find_space(params:)
          Success(Spaces::Space.find(params[:space_id]))
        end

        def find_usage_period(space:)
          Success(Utils::Recurrence.usage_period(record: space))
        end

        def find_usages(relation:, space:, usage_period:)
          usages = relation.where(space_id: space.id)
                           .where(created_at: usage_period)
                           .where(status: :success)
          Success(usages)
        end
      end
    end
  end
end
