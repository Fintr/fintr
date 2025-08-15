# frozen_string_literal: true

module Onboardings
  module Operations
    class ShowBudgetsData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
        end
      end

      CATEGORY_PERCENTAGES = {
        "Home" => 20,
        "Food & Groceries" => 20,
        "Utilities" => 5,
        "Transportation" => 10,
        "Insurance" => 5,
        "Dine Out & Entertainment" => 10,
        "Shopping" => 10,
        "Subscriptions & Hobbies" => 10,
        "Travel & Vacations" => 10
      }.freeze

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def call(params)
        params     = step validate(params)
        onboarding = step find_onboarding(params)
        step show_budget_setup(onboarding)
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure("Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def show_budget_setup(onboarding)
        return Failure("Onboarding data not found") if onboarding.data["income"].blank?

        total_income = onboarding.data["income"]["salary_income"].to_d.round(2) + onboarding.data["income"]["business_income"].to_d.round(2)
        data = CATEGORY_PERCENTAGES.map do |category, percentage|
          amount = (total_income * percentage / 100).round(2)

          { name: category, amount:, percentage: }
        end
        Success(data)
      end
    end
  end
end
