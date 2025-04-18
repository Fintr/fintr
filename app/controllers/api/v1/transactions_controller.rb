# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        query = Transactions::Queries::FilteredTransactions.call(params: filter_params)
        render_success(
          data: {
            transactions_count: query.size,
            transactions: Transactions::Serializers::FilteredTransactions.render_as_hash(query)
          }
        )
      rescue StandardError => e
        render_internal_server_error(details: e.message)
      end

      def filter_params
        params.permit(
          :space_code,
          :start_date,
          :end_date
        )
      end
    end
  end
end
