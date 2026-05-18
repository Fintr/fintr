# frozen_string_literal: true

module Insights
  module Operations
    class CreateSummaryStructure < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactions)
          required(:space).value(:any)
        end

        rule(:transactions) do
          if values[:transactions].present?
          is_relation = values[:transactions].is_a?(ActiveRecord::Relation)
          is_record_transaction = values[:transactions].first.is_a?(Transactions::Transaction)
          key.failure("should be a relation of transactions") unless is_relation || is_record_transaction
          else
            # Allow blank transactions, the operation logic handles the zero calculation
            # This rule primarily validates the type when transactions IS present.
          end
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params            = step validate(params:)
        total_income      = step get_total_income(params:)
        total_expenses    = step get_total_expenses(params:)
        net_savings       = step get_net_savings(total_income:, total_expenses:)
        summary_structure = step create_summary_structure(total_income:, total_expenses:, net_savings:)
        summary_structure
      end

      private

      def get_total_income(params:)
        return Success(0) if params[:transactions].blank?

        space = params[:space]
        total = params[:transactions].inject(0.to_d) do |memo, tx|
          next memo unless tx.is_a?(Transactions::Income)

          memo + Insights::SpaceCurrencyAmount.to_space_decimal(
            money: tx.income,
            date: tx.date.to_date,
            space: space,
            strict: true
          )
        end
        Success(total)
      end

      def get_total_expenses(params:)
        return Success(0) if params[:transactions].blank?

        space = params[:space]
        total = params[:transactions].inject(0.to_d) do |memo, tx|
          next memo unless tx.is_a?(Transactions::Expense)

          memo + Insights::SpaceCurrencyAmount.to_space_decimal(
            money: tx.expense,
            date: tx.date.to_date,
            space: space,
            strict: true
          )
        end
        Success(total)
      end

      def get_net_savings(total_income:, total_expenses:)
        result = total_income.to_d - total_expenses.to_d
        Success(result)
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
