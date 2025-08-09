# frozen_string_literal: true

require "csv"

module Transactions
  module Operations
    module Reports
      # Should not know of the filters. Only the results
      class DownloadCsv < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:combined_transactions)
          end

          rule(:combined_transactions) do
            key.failure("must be combined transactions") if !value.first.is_a?(Transactions::Combined)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params                = step validate(params:)
          combined_transactions = step find_transactions(params:)
          headers               = step define_headers
          csv                   = step build_csv(combined_transactions:, headers:)

          csv
        end

        private

        def find_transactions(params:)
          Success(params[:combined_transactions])
        end

        def define_headers
          headers = [
            "Transactable Type",
            "Transactable ID",
            "Date",
            "Amount",
            "Amount Currency",
            "Description",
            "To Account Name",
            "From Account Name",
            "Category Name",
            "Transaction Cost",
            "Transaction Cost Currency",
            "Balance State"
          ]
          Success(headers)
        end

        def build_csv(combined_transactions:, headers:)
          csv_string = CSV.generate(headers: true) do |csv|
            csv << headers
            combined_transactions.each do |transaction|
              csv << [
                Transactions::Combined::TYPE_MAPPING[transaction.transactable_type],
                transaction.transactable_id,
                transaction.date.strftime("%d/%m/%Y"),
                transaction.amount.amount,
                transaction.amount_currency,
                transaction.description,
                transaction.to_account_name,
                transaction.from_account_name,
                transaction.category_name,
                transaction.transaction_cost&.amount,
                transaction.transaction_cost_currency,
                transaction.balance_state
              ]
            end
          end
          Success(csv_string)
        end
      end
    end
  end
end
