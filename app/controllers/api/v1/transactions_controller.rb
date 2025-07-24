# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        query = ::Transactions::Queries::FilteredCombined.call(params: filter_params)

        return render_internal_server_error(details: query.failure) unless query.success?

        render_paginated(
          query.value!,
          serializer: ::Transactions::Serializers::FilteredCombinedSerializer,
          key: :transactions
        )
      end

      def show
        transaction = ::Transactions::Transaction.find(params[:id])
        serializer = ::Transactions::Serializers::TransactionSerializer.render_as_hash(transaction)
        render_success(data: serializer)
      end

      def create
        params = with_current_params(create_params)
        operation = ::Transactions::Operations::CreateTransaction.new.call(params:)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_created(record: operation.value!)
      end

      def update
        params = with_current_params(update_params)
        operation = ::Transactions::Operations::UpdateTransaction.new.call(params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      def destroy
        params = with_current_params(destroy_params)
        operation = ::Transactions::Operations::DeleteTransaction.new.call(params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end


      private

      def filter_params
        params.permit(
          :space_code,
          :start_date,
          :end_date,
          :category_name,
          :min_amount,
          :max_amount,
          :search_query,
          :page,
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
          :installment_count,
          :file
        )
      end

      def update_params
        params.permit(
          :id,
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
          :installment_count,
          :file,
          :update_scope
        )
      end

      def destroy_params
        params.permit(
          :id,
          :delete_scope
        )
      end
    end
  end
end
