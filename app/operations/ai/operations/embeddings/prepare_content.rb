# frozen_string_literal: true

module Ai
  module Operations
    module Embeddings
      class PrepareContent < Dry::Operation
        def call(embeddable:)
          content = case embeddable
          when Transactions::Transaction
            build_transaction_content(embeddable)
          when Transactions::Transfer
            build_transfer_content(embeddable)
          else
            step return_failure
          end

          content
        end

        private

        def build_transaction_content(transaction)
          amount_display = case transaction.type
          when "Transactions::Expense"
            "-#{transaction.amount.format}"
          when "Transactions::Income"
            "+#{transaction.amount.format}"
          else
            transaction.amount.format
          end

          "Transaction: #{transaction.description}, " \
          "Amount: #{amount_display}, " \
          "Category: #{transaction.category.name}, " \
          "Account: #{transaction.account.name}, " \
          "Date: #{transaction.date.strftime('%B %d, %Y')}, " \
          "Type: #{transaction.type}, " \
          "Space: #{transaction.space.name}"
        end

        def build_transfer_content(transfer)
          "Transfer: #{transfer.description}, " \
          "Amount: #{transfer.amount.format}, " \
          "From Account: #{transfer.from_account.name}, " \
          "To Account: #{transfer.to_account.name}, " \
          "Transaction Cost: #{transfer.transaction_cost.format}, " \
          "Date: #{transfer.date.strftime('%B %d, %Y')}, " \
          "Type: Transfer, " \
          "Space: #{transfer.space.name}"
        end

        def return_failure
          Failure(embeddable_type: "unsupported type")
        end
      end
    end
  end
end
