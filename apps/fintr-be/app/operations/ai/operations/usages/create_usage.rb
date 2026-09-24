# frozen_string_literal: true

module Ai
  module Operations
    module Usages
      # NOTE: this operation is not a Dry::Operation because it needs to be able to handle failures and successes from the block.
      class CreateUsage
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            optional(:ai_type).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return contract.errors.to_h unless contract.success?

          contract.to_h
        end

        def call(params, &block)
          time_start = Time.current
          params = validate(params:)
          user = find_user(params:)
          space = find_space(params:)
          can_use_ai = validate_can_use_ai(user:, space:, params:)
          return Dry::Monads::Failure(can_use_ai) unless can_use_ai == true

          usage = create_usage(params:)
          result = block.call
          result = transform_result(result, usage:, time_start:)
          result
        rescue StandardError => e
          update_usage(usage:, time_start:, status: :failure, result: e.to_json) if defined?(usage) && usage
          Dry::Monads::Failure(e)
        end

        private

        def find_user(params:)
          Auth::User.find(params[:user_id])
        end

        def find_space(params:)
          Spaces::Space.find(params[:space_id])
        end

        def validate_can_use_ai(user:, space:, params:)
          if params[:ai_type] == "ai_chat"
            allowance = EnforceMonthlyChatLimit.new.call(user_id: user.id)
            return true if allowance.success?

            return allowance.failure[:message]
          end

          allowed = Finance::ProGate.require!(
            user_id: user.id,
            space_id: space.id,
          ).success?
          return true if allowed

          "Fintr Pro is required for this feature."
        end

        def create_usage(params:)
          Ai::Usage.create(
            user_id: params[:user_id],
            space_id: params[:space_id],
            ai_type: params[:ai_type] || "pure_ai_ocr",
          )
        end

        def transform_result(result, usage:, time_start:)
          if result.is_a?(Dry::Monads::Success)
            update_usage(usage:, time_start:, result: {})
            Dry::Monads::Success(result.value!)
          elsif result == true
            update_usage(usage:, time_start:, result: {})
            Dry::Monads::Success(result)
          elsif result.is_a?(Dry::Monads::Failure)
            update_usage(usage:, time_start:, status: :failure, result: result.failure)
            Dry::Monads::Failure(result.failure)
          end
        end

        def update_usage(usage:, time_start:, status: :success, result: {})
          usage = usage.update(time_seconds: Time.current - time_start, status:, result:)
          usage
        end
      end
    end
  end
end
