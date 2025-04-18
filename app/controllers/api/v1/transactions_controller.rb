# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        paginated_collection = Transactions::Queries::FilteredTransactions.call(params: filter_params)

        render_paginated(
          paginated_collection,
          serializer: Transactions::Serializers::FilteredTransactions
        )
      rescue StandardError => e
        render_internal_server_error(details: e.message)
      end

      private

      def filter_params
        params.permit(
          :space_code,
          :start_date,
          :end_date,
          :page
        )
      end
    end
  end
end
