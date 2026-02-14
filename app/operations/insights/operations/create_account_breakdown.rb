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
        accounts              = space.accounts.kept.to_a
        account_breakdown     = step create_account_breakdown(accounts:)
        account_breakdown
      end

      private

      def create_account_breakdown(accounts:)
        return Success(total_balance: Utils::Number.format_delimiter(0), breakdown: []) if accounts.empty?

        total_balance_cents = accounts.sum { |a| a.balance.cents }
        total_balance       = total_balance_cents / 100.0

        result = accounts.map do |account|
          balance_cents = account.balance.cents
          percentage    = total_balance.zero? ? 0 : (balance_cents.to_d / total_balance_cents * 100)
          {
            name: account.name,
            balance: {
              cents: balance_cents,
              currency_iso: account.balance.currency.iso_code
            },
            percentage: Utils::Number.format_percentage(percentage),
            category: account.account_category
          }
        end.sort_by { |item| -item[:balance][:cents] }

        Success(
          total_balance: Utils::Number.format_delimiter(total_balance),
          breakdown: result
        )
      end
    end
  end
end
