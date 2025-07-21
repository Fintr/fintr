# frozen_string_literal: true

module Receipts
  module Operations
    class ProcessReceipt < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)
          required(:image_path).value(:string)
          optional(:auto_create_transaction).value(:bool)
          optional(:processing_method).value(:string)
        end

        rule(:image_path) do
          key.failure("file does not exist") unless File.exist?(value)
        end

        rule(:processing_method) do
          if value.present?
            valid_methods = ["ocr_ai", "pure_ai"]
            key.failure("must be one of: #{valid_methods.join(", ")}") unless valid_methods.include?(value)
          end
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
        processing_method         = step determine_processing_method(params:)
        receipt_data              = step process_receipt_with_method(params:, processing_method:)
        confidence_analysis       = step calculate_confidence_for_method(receipt_data:, processing_method:)
        receipt_result            = step format_result_for_method(
                                          receipt_data:,
                                          confidence_analysis:,
                                          processing_method:
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

      def determine_processing_method(params:)
        # Default to OCR+AI if not specified
        method = params[:processing_method] || "pure_ai"
        Success(method)
      end

      def process_receipt_with_method(params:, processing_method:)
        case processing_method
        when "ocr_ai"
          process_with_ocr_ai(params:)
        when "pure_ai"
          process_with_pure_ai(params:)
        else
          Failure(processing_method_error: "Unknown processing method: #{processing_method}")
        end
      end

      def process_with_ocr_ai(params:)
        optimized_image_path = step optimize_image(params:)
        ocr_result = step extract_text(optimized_image_path:)
        ocr_text = step extract_text_from_result(ocr_result:)
        receipt_data = step extract_receipt_data_ocr_ai(ocr_text:, params:)

        # Store OCR text for later use in confidence calculation
        receipt_data[:ocr_text] = ocr_text
        Success(receipt_data)
      end

      def process_with_pure_ai(params:)
        # Pure AI doesn't need image optimization or OCR
        receipt_data = step extract_receipt_data_vision(params:)

        # No OCR text for pure AI method
        receipt_data[:ocr_text] = nil
        Success(receipt_data)
      end

      def calculate_confidence_for_method(receipt_data:, processing_method:)
        case processing_method
        when "ocr_ai"
          calculate_confidence_ocr_ai(receipt_data:)
        when "pure_ai"
          calculate_confidence_vision(receipt_data:)
        else
          Failure(confidence_method_error: "Unknown processing method for confidence: #{processing_method}")
        end
      end

      def format_result_for_method(receipt_data:, confidence_analysis:, processing_method:)
        format_params = {
          receipt_data: receipt_data,
          confidence_analysis: confidence_analysis,
          ocr_text: receipt_data[:ocr_text]
        }
        Receipts::Operations::FormatResult.new.call(params: format_params)
      end

      def optimize_image(params:)
        optimize_params = { image_path: params[:image_path] }
        result = Receipts::Operations::OptimizeImage.new.call(params: optimize_params)
        return result if result.success?

        # Fallback to original image if optimization fails
        Success(params[:image_path])
      end

      def extract_text(optimized_image_path:)
        extract_params = { image_path: optimized_image_path }
        Receipts::Operations::ExtractText.new.call(params: extract_params)
      end

      def extract_text_from_result(ocr_result:)
        # Extract just the text string from the OCR result hash
        text = ocr_result[:text] || ocr_result["text"]
        return Failure(ocr_error: "No text found in OCR result") if text.blank?

        Success(text)
      end

      def extract_receipt_data_ocr_ai(ocr_text:, params:)
        extract_params = {
          ocr_text: ocr_text,
          space_id: params[:space_id]
        }
        Receipts::Operations::ExtractReceiptDataOcrAi.new.call(params: extract_params)
      end

      def extract_receipt_data_vision(params:)
        extract_params = {
          image_path: params[:image_path],
          space_id: params[:space_id]
        }
        Receipts::Operations::ExtractReceiptDataVision.new.call(params: extract_params)
      end

      def calculate_confidence_ocr_ai(receipt_data:)
        confidence_params = {
          receipt_data: receipt_data,
          ocr_text: receipt_data[:ocr_text]
        }
        Receipts::Operations::CalculateConfidenceAi.new.call(params: confidence_params)
      end

      def calculate_confidence_vision(receipt_data:)
        # Vision-based extraction has simpler confidence calculation
        confidence_params = {
          receipt_data: receipt_data,
          ocr_text: "" # No OCR text for vision method
        }
        Receipts::Operations::CalculateConfidenceAi.new.call(params: confidence_params)
      end

      def format_result(receipt_data:, confidence_analysis:, ocr_text:)
        format_params = {
          receipt_data: receipt_data,
          confidence_analysis: confidence_analysis,
          ocr_text: ocr_text
        }
        Receipts::Operations::FormatResult.new.call(params: format_params)
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
        creation_result = Receipts::Operations::CreateTransactionFromReceipt.new.call(params: transaction_params)

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
