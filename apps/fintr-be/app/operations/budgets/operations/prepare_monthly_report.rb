# frozen_string_literal: true

module Budgets
  module Operations
    class PrepareMonthlyReport < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          optional(:date).value(:date)
          optional(:start_date).value(:date)
          optional(:end_date).value(:date)
        end

        rule(:date, :start_date, :end_date) do
          if values[:date].blank? && (values[:start_date].blank? || values[:end_date].blank?)
            key(:date).failure("either date or both start_date and end_date must be provided")
          end
          if values[:date].present? && (values[:start_date].present? || values[:end_date].present?)
            key(:date).failure("cannot provide both date and start_date/end_date")
          end
        end

        rule(:start_date, :end_date) do
          if values[:start_date].present? && values[:end_date].present?
            if values[:start_date] > values[:end_date]
              key(:end_date).failure("must be after start_date")
            end
          end
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Not found") if @space.blank?

        Success(contract.to_h)
      end

      attr_reader :space

      def call(params)
        params                     = step validate(params:)
        date_range                 = step calculate_date_range(params:)
        monthly_budgets_query      = step fetch_monthly_budgets(params:, date_range:)
        monthly_transactions_query = step fetch_monthly_transactions(params:, date_range:)
        output                     = step process_monthly_budgets(
                                        monthly_budgets_query,
                                        monthly_transactions_query,
                                        date_range:
                                      )

        output
      end

      def calculate_date_range(params:)
        if params[:date].present?
          start_date = params[:date].to_date.all_month.first
          end_date = params[:date].to_date.all_month.last
        else
          start_date = params[:start_date].to_date
          end_date = params[:end_date].to_date
        end
        Success({ start_date:, end_date: })
      end

      def fetch_monthly_budgets(params:, date_range:)
        Budgets::Queries::MonthlyBudgets.call(
          params: {
            space_code: params[:space_code],
            start_date: date_range[:start_date],
            end_date: date_range[:end_date]
          }
        )
      end

      def fetch_monthly_transactions(params:, date_range:)
        Transactions::Queries::FilteredTransactions.call(
          params: {
            space_code: params[:space_code],
            start_date: date_range[:start_date],
            end_date: date_range[:end_date],
            category_name: nil,
            balance_state: "calculated",
            transaction_type: "Transactions::Expense",
            paginate: false
          }
        )
      end

      def process_monthly_budgets(_monthly_budgets_query, monthly_transactions_query, date_range:)
        start_month = date_range[:start_date].to_date.beginning_of_month
        end_month = date_range[:end_date].to_date.end_of_month

        monthly_budgets_array = Budget
          .where(space_id: space.id, date: start_month..end_month)
          .includes(:category, :subcategory)
          .to_a

        budget_rows_result = BuildMonthlyBudgetRows.new.call(
          budgets: monthly_budgets_array,
          space_id: space.id,
          start_date: date_range[:start_date],
          end_date: date_range[:end_date]
        )
        return budget_rows_result unless budget_rows_result.success?

        budget_rows = budget_rows_result.value!

        total_budget = monthly_budgets_array.sum(&:amount_cents) / 100.to_d
        total_spent = monthly_transactions_query.sum(:amount_cents) / 100.to_d
        remaining = total_budget - total_spent

        output = {
          budgets: budget_rows,
          summary: {
            total_budget: total_budget.round.to_i,
            total_spent: total_spent.round.to_i,
            total_spent_percentage: total_budget.zero? ? nil : (total_spent / total_budget * 100).round(2),
            remaining: remaining.round.to_i
          }
        }
        Success(output)
      end
    end
  end
end
