# frozen_string_literal: true

module Ai
  module Operations
    module Usages
      class ShowUsage < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:user_id).value(:string)
          end
        end

        def validate(params)
          result = Contract.new.call(params)
          return Failure(result.errors.to_h) if result.failure?

          Success(params.to_h)
        end

        def call(params)
          step Finance::Operations::Entitlements::ResolveProAccess.new.call(params)
        end
      end
    end
  end
end
