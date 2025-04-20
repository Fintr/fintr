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

      def create
        operation = Transactions::Operations::CreateTransaction.new.call(create_params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render json: operation.value!, status: :created
      end

      private

      def filter_params
        params.permit(
          :space_code,
          :start_date,
          :end_date,
          :category_name,
          :page
        ).to_h
      end

      def create_params
        params.permit(
          :amount,
          :date,
          :description,
          :category_name,
          :account_name
        )
      end
    end
  end
end
