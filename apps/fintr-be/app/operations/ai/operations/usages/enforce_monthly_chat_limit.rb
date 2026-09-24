# frozen_string_literal: true

module Ai
  module Operations
    module Usages
      class EnforceMonthlyChatLimit < Dry::Operation
        MONTHLY_LIMIT = 30
        LIMIT_MESSAGE = "You have used all 30 AI chats for this month."

        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).filled(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          step assert_under_limit(params:)
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def assert_under_limit(params:)
          used = Ai::Usage.where(
            user_id: params[:user_id],
            ai_type: :ai_chat,
            created_at: Time.current.all_month,
          ).count

          return Failure(message: LIMIT_MESSAGE) if used >= MONTHLY_LIMIT

          Success(used: used)
        end
      end
    end
  end
end
