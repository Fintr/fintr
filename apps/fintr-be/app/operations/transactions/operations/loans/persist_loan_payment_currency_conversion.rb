# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class PersistLoanPaymentCurrencyConversion < Dry::Operation
        def call(loan_payment:, conversion_data:)
          step ::Transactions::Operations::PersistCurrencyConversion.new.call(
            transaction: loan_payment,
            conversion_data:,
          )
          Success(loan_payment)
        end
      end
    end
  end
end
