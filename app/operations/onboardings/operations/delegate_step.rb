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
        when "income"
          return ShowIncomeData.new.call(params)
        when "budgets"
          operation = ShowBudgetsData.new.call(params)
          return Failure(operation.failure) unless operation.success?

          return Success({ budgets_data: operation.value! })
        when "accounts"
          return ShowAccountsData.new.call(params)
        end
        Failure("Invalid step for show action")
      end

      def create_data(params:)
        case params[:step]
        when "income"
          return IncomeStep.new.call(params)
        when "budgets"
          return BudgetsStep.new.call(params)
        when "accounts"
          return AccountsStep.new.call(params)
        end
        Failure("Invalid step for create action")
      end
    end
  end
end
