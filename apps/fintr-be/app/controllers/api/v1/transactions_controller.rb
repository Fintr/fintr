# frozen_string_literal: true

module Api
  module V1
    class TransactionsController < ApiController
      def index
        query = ::Transactions::Queries::FilteredCombined.call(params: filter_params)

        return render_internal_server_error(details: query.failure) unless query.success?

        # Calculate totals by type using dedicated query
        totals_query = ::Transactions::Queries::TotalsByType.call(params: filter_params)
        totals_by_type = totals_query.success? ? totals_query.value! : { income: 0.0, expense: 0.0, transfer: 0.0 }

        render_paginated_with_totals(
          query.value!,
          serializer: ::Transactions::Serializers::FilteredCombinedSerializer,
          key: :transactions,
          totals: totals_by_type
        )
      end

      def show
        transaction = ::Transactions::Transaction.includes(:currency_conversion).find(params[:id])
        serializer = ::Transactions::Serializers::TransactionSerializer.render_as_hash(transaction)
        render_success(data: serializer)
      end

      def create
        params = with_current_params(create_params)
        operation = ::Transactions::Operations::CreateTransaction.new.call(params)

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

      def generate_csv
        query = ::Transactions::Queries::FilteredCombined.call(params: filter_params.merge(paginate: false))
        operation = ::Transactions::Operations::Reports::DownloadCsv.new.call(combined_transactions: query.value!)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        filename = "transactions_#{Time.zone.now.strftime("%Y-%m-%d")}.csv"
        send_data operation.value!, filename:, type: "text/csv"
      end

      def note_suggestions
        params = with_current_params(note_suggestions_params)
        query = ::Transactions::Queries::NoteSuggestions.call(params:)

        return render_internal_server_error(details: query.failure) unless query.success?

        render_success(data: { suggestions: query.value! })
      end


      private

      def filter_params
        params.permit(
          :space_code,
          :start_date,
          :end_date,
          :category_name,
          :category_id,
          :subcategory_id,
          :account_name,
          :account_id,
          :min_amount,
          :max_amount,
          :search_query,
          :entry_type,
          :page,
          category_filters: [],
          account_names: [],
          tag_ids: [],
        ).to_h
      end

      def create_params
        params.permit(
          :amount,
          :date,
          :description,
          :transaction_type,
          :category_name,
          :category_id,
          :subcategory_id,
          :account_name,
          :schedule_type,
          :repeat_interval,
          :repeat_count,
          :installment_period,
          :installment_count,
          :draft_id,
          :file,
          :file_id,
          :original_currency,
          :exchange_rate,
          :exchange_rate_source,
          :amount_in_currency,
          :client_mutation_id,
          :entity_name,
          tag_ids: [],
        )
      end

      def update_params
        params.permit(
          :id,
          :amount,
          :date,
          :description,
          :transaction_type,
          :category_name,
          :category_id,
          :subcategory_id,
          :account_name,
          :schedule_type,
          :repeat_interval,
          :repeat_count,
          :installment_period,
          :installment_count,
          :file,
          :remove_file,
          :update_scope,
          :original_currency,
          :exchange_rate,
          :exchange_rate_source,
          :amount_in_currency,
          :entity_name,
          tag_ids: [],
        )
      end

      def destroy_params
        params.permit(
          :id,
          :delete_scope
        )
      end

      def note_suggestions_params
        params.permit(
          :space_code,
          :category_name,
          :transaction_type
        ).to_h
      end
    end
  end
end
