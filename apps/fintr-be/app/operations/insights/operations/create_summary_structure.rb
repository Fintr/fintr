# frozen_string_literal: true

module Insights
  module Operations
    class CreateSummaryStructure < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space).value(:any)
          optional(:transactions)
          optional(:start_date).maybe(:date)
          optional(:end_date).maybe(:date)
          optional(:category_filtered).maybe(:bool)
        end

        rule(:transactions) do
          next if values[:transactions].blank?

          is_relation = values[:transactions].is_a?(ActiveRecord::Relation)
          is_record_transaction = values[:transactions].first.is_a?(Transactions::Transaction)
          key.failure("should be a relation of transactions") unless is_relation || is_record_transaction
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params            = step validate(params:)
        totals            = step resolve_totals(params:)
        summary_structure = step create_summary_structure(
          total_income: totals[:total_income],
          total_expenses: totals[:total_expenses],
          net_savings: totals[:net_savings]
        )
        summary_structure
      end

      private

      def resolve_totals(params:)
        if use_monthly_summaries?(params:)
          return totals_from_monthly_summaries(params:)
        end

        totals_from_transactions(params:)
      end

      def use_monthly_summaries?(params:)
        params[:category_filtered] != true &&
          params[:start_date].present? &&
          params[:end_date].present?
      end

      def totals_from_monthly_summaries(params:)
        result = MonthlyFinancialSummaries::Queries::TotalsInSpaceForRange.call(
          space: params[:space],
          start_date: params[:start_date],
          end_date: params[:end_date]
        )
        return result unless result.success?

        Success(result.value!)
      end

      def totals_from_transactions(params:)
        return Success(default_totals) if params[:transactions].blank?

        total_income = params[:transactions].inject(0.to_d) do |memo, tx|
          next memo unless tx.is_a?(Transactions::Income)

          memo + tx.amount_numeric_for_space_total.to_d
        end
        total_expenses = params[:transactions].inject(0.to_d) do |memo, tx|
          next memo unless tx.is_a?(Transactions::Expense)

          memo + tx.amount_numeric_for_space_total.to_d.abs
        end

        Success(
          {
            total_income:,
            total_expenses:,
            net_savings: total_income - total_expenses
          }
        )
      end

      def default_totals
        {
          total_income: 0.to_d,
          total_expenses: 0.to_d,
          net_savings: 0.to_d
        }
      end

      def create_summary_structure(total_income:, total_expenses:, net_savings:)
        hash = {
          total_income: Utils::Number.format_number(total_income),
          total_expenses: Utils::Number.format_number(total_expenses),
          net_savings: Utils::Number.format_number(net_savings)
        }
        Success(hash)
      end
    end
  end
end
