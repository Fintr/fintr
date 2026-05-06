# frozen_string_literal: true

module Ai
  module Operations
    module Receipts
      class CreateDraftFromReceiptResult < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:params).hash do
              required(:user_id).value(:string)
              required(:space_id).value(:string)
              required(:image_path).value(:string)
              optional(:file)
            end
            required(:receipt_result).hash do
              required(:suggested_transaction_payload).hash do
                required(:amount).value(:decimal)
                required(:date).value(:date)
                required(:transaction_type).value(:string, included_in?: %w[income expense])
                required(:category_name).value(:string)
                required(:account_name).value(:string)
                required(:description).value(:string)
              end
            end
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params      = step validate(params:)
          transaction = step create_draft(params:)
          _           = step delete_old_drafts(params:)
          transaction
        end

        private

        def create_draft(params:)
          transaction_params = params[:receipt_result][:suggested_transaction_payload].merge(
            user_id: params[:params][:user_id],
            space_id: params[:params][:space_id],
            schedule_type: "one_time"
          )

          # Only add file if it's present
          transaction_params[:file] = params[:params][:file] if params[:params][:file].present?
          transaction_params[:draft] = true # Create a draft transaction

          Transactions::Operations::CreateTransaction.new.call(transaction_params)
        end

        def delete_old_drafts(params:)
          all_drafts = Transactions::Draft
            .where(
              user_id: params[:params][:user_id],
              space_id: params[:params][:space_id]
            )
            .order(created_at: :desc)

          all_drafts.offset(Transactions::Draft::MAX_DRAFTS).destroy_all if all_drafts.count > Transactions::Draft::MAX_DRAFTS
          Success()
        end
      end
    end
  end
end
