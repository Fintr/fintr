# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      module Tools
        class FetchTransaction < RubyLLM::Tool
          include Auditable

          description <<~DESC
            Fetch full details for a single transaction by id (from `[txn:N]` tags in search results).
            Use when the user needs more context about a specific transaction.
          DESC

          param :transaction_id,
            type: "integer",
            desc: "Transaction id from [txn:N] tag",
            required: true

          def initialize(
            space_id:,
            collector:
          )
            @space_id = space_id
            @collector = collector
            super()
          end

          def name
            "fetch_transaction"
          end

          def execute(transaction_id:)
            tool_arguments = { transaction_id: transaction_id }

            space = Spaces::Space.find_by(id: @space_id)
            unless space
              return audit_and_return(
                arguments: tool_arguments,
                result: "Space not accessible.",
              )
            end

            transaction = space.transactions
              .includes(:category, :account)
              .find_by(id: transaction_id)

            unless transaction
              return audit_and_return(
                arguments: tool_arguments,
                result: "Transaction #{transaction_id} not found or not accessible.",
              )
            end

            @collector.record_structured_data([{ id: transaction.id }])

            result = [
              "Transaction [txn:#{transaction.id}]",
              "Date: #{transaction.date}",
              "Description: #{transaction.description}",
              "Amount: #{transaction.amount.format}",
              "Category: #{transaction.category&.name}",
              "Account: #{transaction.account&.name}",
              "Type: #{transaction.type&.demodulize&.downcase}",
            ].join("\n")

            audit_and_return(
              arguments: tool_arguments,
              result: result,
            )
          rescue StandardError => e
            Rails.logger.warn "[Agent] fetch_transaction failed: #{e.message}"
            audit_and_return(
              arguments: tool_arguments,
              result: "Could not load transaction #{transaction_id}.",
            )
          end
        end
      end
    end
  end
end
