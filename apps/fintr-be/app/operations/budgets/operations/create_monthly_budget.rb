# frozen_string_literal: true

module Budgets
  module Operations
    class CreateMonthlyBudget < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
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
        _        = step skip_if_already_created(space:, date: params[:date])
        budgets  = step create_monthly_budgets(space:, date: params[:date])
        budgets
      end

      def find_space(params:)
        space = Spaces::Space.find(params[:space_id])
        Success(space)
      rescue ActiveRecord::RecordNotFound
        Failure(space_id: "not found")
      end

      def skip_if_already_created(space:, date:)
        return Failure(budgets: "Already created for the month of #{date.strftime("%B %Y")}") if space.budgets.for_month(date).exists?

        Success(space:, date:)
      end

      def create_monthly_budgets(space:, date:)
        records = space.budgets.for_month(date - 1.month).map do |budget|
          Budget.new(
            space:,
            category: budget.category,
            amount_cents: budget.amount_cents,
            amount_currency: budget.amount_currency,
            date:
          )
        end
        result = Budget.bulk_import(records, validate: true, all_or_none: true)
        puts "Result: #{result.inspect}"
        Success(result.results)
      rescue ActiveRecord::RecordInvalid => e
        Failure(budgets: result.failed_instances, error: e, expected: true)
      end
    end
  end
end
