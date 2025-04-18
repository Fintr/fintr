# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        query = Transactions::Queries::FilteredTransactions.call(params:)
        render_success(
          data: {
            transactions: Transactions::Serializers::FilteredTransactions.render_as_hash(query.to_a)
          }
        )
      rescue StandardError => e
        render_internal_server_error(details: e.message)
      end
    end
  end
end
