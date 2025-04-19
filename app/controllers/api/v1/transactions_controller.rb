# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        query = Transactions::Queries::FilteredTransactions.call(params: filter_params)

        return render_internal_server_error(details: query.failure) unless query.success?

        render_paginated(
          query.value!,
          serializer: Transactions::Serializers::FilteredTransactions,
          key: :transactions
        )
      end

      private

      def filter_params
        params.permit(
          :space_code,
          :start_date,
          :end_date,
          :page
        ).to_h
      end
    end
  end
end
