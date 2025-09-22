# frozen_string_literal: true

module Insights
  module Operations
    class CreateAccountBreakdown < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space)
        end

        rule(:space) do
          key.failure("should be a space") unless values[:space].is_a?(Spaces::Space)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params                = step validate(params:)
        space                 = params[:space]
        accounts              = space.accounts
        account_breakdown     = step create_account_breakdown(accounts:)
        account_breakdown
      end

      private

      def create_account_breakdown(accounts:)
        total_balance = accounts.sum(&:balance).amount
        result = accounts.map do |account|
          {
            name: account.name,
            balance: Utils::Number.format_number(account.balance),
            percentage: Utils::Number.format_percentage((account.balance.to_d / total_balance) * 100),
            category: account.account_category
          }
        end.sort_by { |account| account[:balance].to_d }.reverse
        Success(total_balance: Utils::Number.format_delimiter(total_balance), breakdown: result)
      end
    end
  end
end
