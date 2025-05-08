# frozen_string_literal: true

module Budgets
  module Operations
    class CreateMonthlyBudget < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:integer)
          required(:date).value(:date)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(errors: contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params   = step validate(params:)
        space    = step find_space(params:)
        budgets  = step create_monthly_budgets(space:, date:)
        budgets
      end

      def find_space(params:)
        space = Spaces::Space.find(params[:space_id])
        Success(space)
      rescue ActiveRecord::RecordNotFound
        Failure(space_id: "not found")
      end

      def create_monthly_budget(space:, date:)
        records = space.budgets.for_month(date).map do |budget|
          Budget.new(
            space:,
            category: budget.category,
            date:
          )
        end

        result = Budget.bulk_import(records, validate: true, all_or_none: true)
        Success(result.results)
      rescue ActiveRecord::RecordInvalid
        Failure(budgets: result.failed_instances)
      end
    end
  end
end
