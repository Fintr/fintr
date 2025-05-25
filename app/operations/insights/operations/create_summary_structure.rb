# frozen_string_literal: true

module Insights
  module Operations
    class CreateSummaryStructure < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactions)
        end

        rule(:transactions) do
          key.failure("should be an array of transactions") unless values[:transactions].first.is_a?(Transactions::Combined)
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
        result = params[:transactions].sum(&:income).amount
        Success(result)
      end

      def get_total_expenses(params:)
        result = params[:transactions].sum(&:expense).amount
        Success(result)
      end

      def get_net_savings(total_income:, total_expenses:)
        result = total_income - total_expenses
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
