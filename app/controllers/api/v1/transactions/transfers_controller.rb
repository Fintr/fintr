# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class TransfersController < ApiController
        def create
          params = with_current_params(create_params)
          operation = ::Transactions::Operations::Transfers::CreateTransfer.new.call(params:)

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        def show
          transfer = ::Transactions::Transfer.find(params[:id])
          serializer = ::Transactions::Serializers::TransferSerializer.render_as_hash(transfer)
          render_success(data: serializer)
        end

        def update
          params = with_current_params(update_params)
          operation = ::Transactions::Operations::Transfers::UpdateTransfer.new.call(params)

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        def destroy
          params = with_current_params(destroy_params)
          operation = ::Transactions::Operations::Transfers::DeleteTransfer.new.call(params)

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        private

        def create_params
          params.permit(
            :amount,
            :transaction_cost,
            :date,
            :description,
            :from_account_name,
            :to_account_name,
            :schedule_type,
            :repeat_interval,
            :repeat_count,
            :file
          )
        end

        def update_params
          params.permit(
            :id,
            :update_scope,
            :amount,
            :transaction_cost,
            :date,
            :description,
            :from_account_name,
            :to_account_name,
            :schedule_type,
            :repeat_interval,
            :repeat_count,
            :file
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
end
