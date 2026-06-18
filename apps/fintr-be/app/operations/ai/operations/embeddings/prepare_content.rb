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
          "#{transaction.description}. " \
          "#{format_amount_display(transaction)} #{human_transaction_type(transaction)} " \
          "in #{format_category_label(transaction)} via #{transaction.account.name} " \
          "on #{format_date(transaction.date)}."
        end

        def build_transfer_content(transfer)
          "#{transfer.description}. " \
          "#{transfer.amount.format} transfer from #{transfer.from_account.name} " \
          "to #{transfer.to_account.name} with #{transfer.transaction_cost.format} fee " \
          "on #{format_date(transfer.date)}."
        end

        def format_amount_display(transaction)
          case transaction.type
          when "Transactions::Expense"
            "-#{transaction.amount.format}"
          when "Transactions::Income"
            "+#{transaction.amount.format}"
          else
            transaction.amount.format
          end
        end

        def human_transaction_type(transaction)
          case transaction.type
          when "Transactions::Expense"
            "expense"
          when "Transactions::Income"
            "income"
          else
            "transaction"
          end
        end

        def format_category_label(transaction)
          label = transaction.category.name
          return label if transaction.subcategory_id.blank?

          "#{label}, #{transaction.subcategory.name}"
        end

        def format_date(date)
          date.strftime("%B %d, %Y")
        end

        def return_failure
          Failure(embeddable_type: "unsupported type")
        end
      end
    end
  end
end
