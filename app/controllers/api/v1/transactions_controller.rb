# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        query = ::Transactions::Queries::FilteredTransactions.call(params: filter_params)

        return render_internal_server_error(details: query.failure) unless query.success?

        render_paginated(
          query.value!,
          serializer: ::Transactions::Serializers::FilteredTransactions,
          key: :transactions
        )
      end

      def create
        params = with_current_params(create_params)
        operation = ::Transactions::Operations::CreateTransaction.new.call(params:)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_created(record: operation.value!)
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
          :account_name,
          :expense_type,
          :schedule_type,
          :repeat_interval,
          :repeat_count,
          :installment_period,
          :installment_count
        )
      end
    end
  end
end
