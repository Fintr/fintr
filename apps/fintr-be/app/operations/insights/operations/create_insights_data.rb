# frozen_string_literal: true

module Insights
  module Operations
    class CreateInsightsData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:space_code).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:category_name).maybe(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
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
        params                 = step validate(params:)
        transactions           = step find_transactions(params:)
        budgets                = step find_budgets(params:)
        summary_structure      = step create_summary_structure(transactions:, space:)
        health_scores          = step create_health_scores(summary_structure:, budgets:)
        expense_breakdown      = step create_expense_breakdown(transactions:, space:)
        weekly_spending        = step create_weekly_spending(transactions:, space:)
        monthly_spending       = step create_monthly_spending(params:)
        account_breakdown      = step create_account_breakdown(space:)
        {
          summary_structure:,
          health_scores:,
          expense_breakdown:,
          weekly_spending:,
          monthly_spending:,
          account_breakdown:
        }
      end

      private

      def find_transactions(params:)
        params_for_calculated_transactions = params.merge(
          balance_state: "calculated",
          paginate: false,
          without_initial_balance: true
        )
        Transactions::Queries::FilteredTransactions.call(params: params_for_calculated_transactions)
      end

      def find_budgets(params:)
        Budgets::Queries::MonthlyBudgets.call(
          params: {
            space_code: params[:space_code],
            start_date: params[:start_date],
            end_date: params[:end_date]
          }
        )
      end

      def create_summary_structure(transactions:, space:)
        Insights::Operations::CreateSummaryStructure.new.call(
          transactions:,
          space:
        )
      end

      def create_health_scores(summary_structure:, budgets:)
        Insights::Operations::CreateHealthScores.new.call(summary_structure:, budgets:)
      end

      def create_expense_breakdown(transactions:, space:)
        Insights::Operations::CreateExpenseBreakdown.new.call(
          transactions:,
          space:
        )
      end

      def create_weekly_spending(transactions:, space:)
        Insights::Operations::CreateWeeklySpending.new.call(
          transactions:,
          space:
        )
      end

      def create_monthly_spending(params:)
        params = {
          space_id: params[:space_id],
          date_from: 6.months.ago.beginning_of_month.to_date
        }
        Insights::Queries::MonthlySpending.call(params:)
      end

      def create_account_breakdown(space:)
        Insights::Operations::CreateAccountBreakdown.new.call(space:)
      end
    end
  end
end
