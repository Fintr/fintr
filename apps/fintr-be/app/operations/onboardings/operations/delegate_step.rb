# frozen_string_literal: true

module Onboardings
  module Operations
    class DelegateStep < Dry::Operation
      def call(params)
        return step(show_data(params:)) if params[:action] == "show"
        return step(create_data(params:)) if params[:action] == "create"

        Failure("Invalid action")
      end

      private

      def show_data(params:)
        case params[:step]
        when "currency"
          return ShowCurrencyData.new.call(params)
        when "income"
          return ShowIncomeData.new.call(params)
        when "budgets"
          operation = ShowBudgetsData.new.call(params)
          return Failure(operation.failure) unless operation.success?

          show_income_data = ShowIncomeData.new.call(params)
          return Failure(show_income_data.failure) unless show_income_data.success?

          return Success({ budgets_data: operation.value!, income_data: show_income_data.value! })
        when "accounts"
          return ShowAccountsData.new.call(params)
        end
        Failure("Invalid step for show action")
      end

      def create_data(params:)
        case params[:step]
        when "currency"
          return CurrencyStep.new.call(params)
        when "income"
          return IncomeStep.new.call(params)
        when "budgets"
          return BudgetsStep.new.call(params)
        when "accounts"
          return AccountsStep.new.call(params)
        when "skip"
          return SkipOnboarding.new.call(params)
        end
        Failure("Invalid step for create action")
      end
    end
  end
end
