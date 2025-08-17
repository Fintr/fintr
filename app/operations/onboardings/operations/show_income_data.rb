# frozen_string_literal: true

module Onboardings
  module Operations
    class ShowIncomeData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params)
        onboarding = step find_onboarding(params)
        step show_income_setup(onboarding)
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure("Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def show_income_setup(onboarding)
        Success({
          salary_income: onboarding.data.dig("income", "salary_income"),
          business_income: onboarding.data.dig("income", "business_income")
        })
      end
    end
  end
end
