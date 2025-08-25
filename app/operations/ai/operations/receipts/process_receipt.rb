# frozen_string_literal: true

module Ai
  module Operations
    module Receipts
      class ProcessReceipt < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:image_path).value(:string)
            optional(:auto_create_transaction).value(:bool)
          end

          rule(:image_path) do
            key.failure("file does not exist") unless File.exist?(value)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params:)
          params                    = step validate(params:)
          receipt_data              = step extract_receipt_data_vision(params:)
          confidence_analysis       = step calculate_confidence_vision(receipt_data:)
          receipt_result            = step format_result(
                                            receipt_data:,
                                            confidence_analysis:
                                          )
          transaction               = step create_transaction_if_requested(
                                            params:,
                                            receipt_result:
                                          )
          final_result              = step prepare_final_result(
                                            receipt_result:,
                                            transaction:
                                          )
          final_result
        end

        private

        def extract_receipt_data_vision(params:)
          extract_params = {
            image_path: params[:image_path],
            space_id: params[:space_id]
          }
          Ai::Operations::Receipts::ExtractReceiptDataVision.new.call(params: extract_params)
        end

        def calculate_confidence_vision(receipt_data:)
          confidence_params = {
            receipt_data: receipt_data,
            ocr_text: "" # No OCR text for vision method
          }
          Ai::Operations::Receipts::CalculateConfidenceAi.new.call(params: confidence_params)
        end

        def format_result(receipt_data:, confidence_analysis:)
          format_params = {
            receipt_data: receipt_data,
            confidence_analysis: confidence_analysis,
            ocr_text: nil # No OCR text for pure AI
          }
          Ai::Operations::Receipts::FormatResult.new.call(params: format_params)
        end

        def create_transaction_if_requested(params:, receipt_result:)
          return Success(nil) unless params[:auto_create_transaction]
          return Success(nil) if receipt_result[:confidence_summary][:should_review]

          transaction_params = {
            user_id: params[:user_id],
            space_id: params[:space_id],
            receipt_data: receipt_result[:extracted_data]
          }

          # Call the transaction creation operation and convert any failure to Success(nil)
          # to allow the main receipt processing flow to continue.
          creation_result = Ai::Operations::Receipts::CreateTransactionFromReceipt.new.call(params: transaction_params)

          if creation_result.success?
            creation_result
          else
            # Log the transaction creation failure but return success(nil) for the main flow
            Rails.logger.warn "Transaction creation failed: #{creation_result.failure}"
            Success(nil)
          end
        end

        def prepare_final_result(receipt_result:, transaction:)
          result = receipt_result.dup
          result[:transaction] = transaction if transaction.present?
          result[:processing_time] = Time.current
          Success(result)
        end
      end
    end
  end
end
