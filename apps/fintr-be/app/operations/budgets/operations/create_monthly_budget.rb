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
        params = step validate(params:)
        space  = step find_space(params:)
        step upsert_monthly_budgets(space:, date: params[:date])
      end

      def find_space(params:)
        space = Spaces::Space.find(params[:space_id])
        Success(space)
      rescue ActiveRecord::RecordNotFound
        Failure(space_id: "not found")
      end

      def upsert_monthly_budgets(space:, date:)
        existing = space.budgets.for_month(date).to_a
        previous = space.budgets.for_month(date - 1.month).to_a
        return Success(existing) if previous.empty?

        existing_keys = existing.map do |budget|
          [budget.category_id, budget.subcategory_id]
        end
        missing = previous.reject do |budget|
          existing_keys.include?([budget.category_id, budget.subcategory_id])
        end
        return Success(existing) if missing.empty?

        create_monthly_budgets(space:, date:, source_budgets: missing, existing:)
      end

      def create_monthly_budgets(space:, date:, source_budgets:, existing:)
        records = source_budgets.map do |budget|
          Budget.new(
            space:,
            category: budget.category,
            subcategory_id: budget.subcategory_id,
            amount_cents: budget.amount_cents,
            amount_currency: budget.amount_currency,
            date: date.beginning_of_month
          )
        end
        result = Budget.bulk_import(records, validate: true, all_or_none: true)
        Success(existing + result.results)
      rescue ActiveRecord::RecordInvalid => e
        Failure(budgets: result.failed_instances, error: e, expected: true)
      end
    end
  end
end
