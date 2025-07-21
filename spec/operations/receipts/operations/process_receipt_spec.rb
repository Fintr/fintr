# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::ProcessReceipt, type: :operation do
  subject(:operation) { described_class.new }

  let(:user_id) { SecureRandom.uuid }
  let(:space_id) { SecureRandom.uuid }
  let(:image_path) { Rails.root.join("spec/fixtures/files/test_receipt.jpg").to_s }

  # Ensure a test image exists for file existence validation
  before do
    unless File.exist?(image_path)
      FileUtils.mkdir_p(File.dirname(image_path))
      File.write(image_path, "test image content")
    end
  end

  after do
    File.delete(image_path) if File.exist?(image_path)
  end

  describe "Contract" do
    let(:params) do
      {
        user_id: user_id,
        space_id: space_id,
        image_path: image_path,
        auto_create_transaction: false,
        processing_method: "pure_ai"
      }
    end

    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "fails without a user_id" do
      params.delete(:user_id)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:user_id)
    end

    it "fails without a space_id" do
      params.delete(:space_id)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails without an image_path" do
      params.delete(:image_path)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:image_path)
    end

    it "fails if image_path does not exist" do
      params[:image_path] = "/non/existent/path.jpg"
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:image_path)
    end

    it "succeeds with auto_create_transaction as true" do
      params[:auto_create_transaction] = true
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "succeeds with nil processing_method (defaults to pure_ai)" do
      params.delete(:processing_method)
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "succeeds with 'ocr_ai' processing_method" do
      params[:processing_method] = "ocr_ai"
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "succeeds with 'pure_ai' processing_method" do
      params[:processing_method] = "pure_ai"
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "fails with an invalid processing_method" do
      params[:processing_method] = "invalid_method"
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:processing_method)
    end
  end

  describe "#call" do
    let(:params) do
      {
        user_id: user_id,
        space_id: space_id,
        image_path: image_path,
        auto_create_transaction: false,
        processing_method: "pure_ai"
      }
    end

    let(:optimized_image_path) { "/tmp/optimized_image.jpg" }
    let(:ocr_text_result) { { text: "Sample OCR Text" } }
    let(:extracted_data_success) { Success({ extracted_fields: { total_amount: { value: "100.00", confidence_score: 0.9 } }, suggested_category: "Groceries" }) }
    let(:confidence_analysis_success) { Success(field_confidence: {}, overall_confidence: 0.9, reliability_assessment: {}, validation_flags: { should_review: false }, recommendations: []) }
    let(:formatted_result_success) do
      Success(
        extracted_data: { total_amount: { value: "100.00" } },
        confidence_summary: { overallScore: 0.9, shouldReview: false },
        validation_flags: { reasonableAmount: true },
        suggested_transaction_payload: { amount: 100.00, category_name: "Groceries" },
        processing_timestamp: Time.current
      )
    end
    let(:transaction_creation_success) { Success({ transaction_id: SecureRandom.uuid }) }

    before do
      # Stub sub-operations that are always called or have specific behavior
      allow(Receipts::Operations::OptimizeImage).to receive(:new) do |*args|
        instance_double("Receipts::Operations::OptimizeImage").tap do |op|
          allow(op).to receive(:call).and_return(Success(optimized_image_path))
        end
      end

      allow(Receipts::Operations::ExtractText).to receive(:new) do |*args|
        instance_double("Receipts::Operations::ExtractText").tap do |op|
          allow(op).to receive(:call).and_return(Success(ocr_text_result))
        end
      end

      allow(Receipts::Operations::ExtractReceiptDataOcrAi).to receive(:new) do |*args|
        instance_double("Receipts::Operations::ExtractReceiptDataOcrAi").tap do |op|
          allow(op).to receive(:call).and_return(extracted_data_success)
        end
      end

      allow(Receipts::Operations::ExtractReceiptDataVision).to receive(:new) do |*args|
        instance_double("Receipts::Operations::ExtractReceiptDataVision").tap do |op|
          allow(op).to receive(:call).and_return(extracted_data_success)
        end
      end

      allow(Receipts::Operations::CalculateConfidenceAi).to receive(:new) do |*args|
        instance_double("Receipts::Operations::CalculateConfidenceAi").tap do |op|
          allow(op).to receive(:call).and_return(confidence_analysis_success)
        end
      end

      allow(Receipts::Operations::FormatResult).to receive(:new) do |*args|
        instance_double("Receipts::Operations::FormatResult").tap do |op|
          allow(op).to receive(:call).and_return(formatted_result_success)
        end
      end

      # Explicitly allow new and call_original for CreateTransactionFromReceipt to enable spying.
      # Its specific call behavior (Success/Failure) will be stubbed in relevant contexts.
      allow(Receipts::Operations::CreateTransactionFromReceipt).to receive(:new).and_call_original
    end

    context "when processing with 'pure_ai' method" do
      let(:params) { super().merge(processing_method: "pure_ai") }

      it "successfully processes the receipt and returns formatted result" do
        result = operation.call(params: params)
        expect(result).to be_success
        expect(result.value!).to include(
          extracted_data: kind_of(Hash),
          confidence_summary: kind_of(Hash),
          validation_flags: kind_of(Hash),
          suggested_transaction_payload: kind_of(Hash)
        )
        expect(result.value![:transaction]).to be_nil # auto_create_transaction is false

        # Verify that OptimizeImage and ExtractText are NOT called for pure_ai
        expect(Receipts::Operations::OptimizeImage).not_to have_received(:new)
        expect(Receipts::Operations::ExtractText).not_to have_received(:new)

        expect(Receipts::Operations::ExtractReceiptDataVision).to have_received(:new).with(no_args)

        # Ensure CreateTransactionFromReceipt is NOT called when auto_create_transaction is false
        expect(Receipts::Operations::CreateTransactionFromReceipt).not_to have_received(:new)
      end

      it "does not create a transaction when auto_create_transaction is false" do
        result = operation.call(params: params)
        expect(result).to be_success
        expect(Receipts::Operations::CreateTransactionFromReceipt).not_to have_received(:new)
      end

      it "creates a transaction when auto_create_transaction is true and no review is needed" do
        params[:auto_create_transaction] = true
        confidence_analysis_success_no_review = Success(field_confidence: {}, overall_confidence: 0.9, reliability_assessment: {}, validation_flags: { should_review: false }, recommendations: [])

        # Stub the specific instance for this test
        allow(Receipts::Operations::CalculateConfidenceAi).to receive(:new) do |*args|
          instance_double("Receipts::Operations::CalculateConfidenceAi").tap do |op|
            allow(op).to receive(:call).and_return(confidence_analysis_success_no_review)
          end
        end

        # Stub CreateTransactionFromReceipt specifically for this test to return success
        create_transaction_from_receipt_double = instance_double("Receipts::Operations::CreateTransactionFromReceipt")
        allow(Receipts::Operations::CreateTransactionFromReceipt).to receive(:new).and_return(create_transaction_from_receipt_double)
        allow(create_transaction_from_receipt_double).to receive(:call).and_return(transaction_creation_success)

        result = operation.call(params: params)
        expect(result).to be_success
        expect(Receipts::Operations::CreateTransactionFromReceipt).to have_received(:new)
        expect(create_transaction_from_receipt_double).to have_received(:call).with(params: hash_including(user_id: user_id, space_id: space_id))
        expect(result.value![:transaction]).to be_present
      end

      it "does not create a transaction when auto_create_transaction is true but review is needed" do
        params[:auto_create_transaction] = true
        confidence_analysis_needs_review = Success(field_confidence: {}, overall_confidence: 0.6, reliability_assessment: {}, validation_flags: { should_review: true }, recommendations: [])

        # Stub the specific instance for this test
        allow(Receipts::Operations::CalculateConfidenceAi).to receive(:new) do |*args|
          instance_double("Receipts::Operations::CalculateConfidenceAi").tap do |op|
            allow(op).to receive(:call).and_return(confidence_analysis_needs_review)
          end
        end

        # Stub FormatResult to return a result that indicates review is needed
        formatted_result_needs_review = Success(
          extracted_data: { total_amount: { value: "100.00" } },
          confidence_summary: { overallScore: 0.6, shouldReview: true }, # Key change here
          validation_flags: { reasonableAmount: true },
          suggested_transaction_payload: { amount: 100.00, category_name: "Groceries" },
          processing_timestamp: Time.current
        )
        allow(Receipts::Operations::FormatResult).to receive(:new) do |*args|
          instance_double("Receipts::Operations::FormatResult").tap do |op|
            allow(op).to receive(:call).and_return(formatted_result_needs_review)
          end
        end

        # Ensure CreateTransactionFromReceipt is NOT called in this scenario
        expect(Receipts::Operations::CreateTransactionFromReceipt).not_to have_received(:new)

        result = operation.call(params: params)
        expect(result).to be_success
        expect(result.value![:transaction]).to be_nil
      end

      it "fails if validation fails" do
        allow(operation).to receive(:validate).and_return(Failure({ user_id: ["must be present"] }))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:user_id)
      end

      it "fails if determine_processing_method fails" do
        allow(operation).to receive(:determine_processing_method).and_return(Failure(processing_method_error: "error"))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:processing_method_error)
      end

      it "fails if process_receipt_with_method fails" do
        allow(operation).to receive(:process_receipt_with_method).and_return(Failure(process_error: "error"))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:process_error)
      end

      it "fails if calculate_confidence_for_method fails" do
        allow(operation).to receive(:calculate_confidence_for_method).and_return(Failure(confidence_error: "error"))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:confidence_error)
      end

      it "fails if format_result_for_method fails" do
        allow(operation).to receive(:format_result_for_method).and_return(Failure(format_error: "error"))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:format_error)
      end

      it "returns success even if create_transaction_if_requested fails, but transaction is nil" do
        params[:auto_create_transaction] = true
        # Stub the specific instance for this test to return failure
        create_transaction_from_receipt_double = instance_double("Receipts::Operations::CreateTransactionFromReceipt")
        allow(Receipts::Operations::CreateTransactionFromReceipt).to receive(:new).and_return(create_transaction_from_receipt_double)
        allow(create_transaction_from_receipt_double).to receive(:call).and_return(Failure(transaction_error: "transaction error"))

        result = operation.call(params: params)
        expect(result).to be_success
        expect(result.value![:transaction]).to be_nil
      end
    end

    context "when processing with 'ocr_ai' method" do
      let(:params) { super().merge(processing_method: "ocr_ai") }

      it "successfully processes the receipt and returns formatted result" do
        result = operation.call(params: params)
        expect(result).to be_success
        expect(result.value!).to include(
          extracted_data: kind_of(Hash),
          confidence_summary: kind_of(Hash),
          validation_flags: kind_of(Hash),
          suggested_transaction_payload: kind_of(Hash)
        )
        expect(result.value![:transaction]).to be_nil # auto_create_transaction is false

        # Verify that OptimizeImage and ExtractText are called for ocr_ai
        expect(Receipts::Operations::OptimizeImage).to have_received(:new).with(no_args)
        expect(Receipts::Operations::ExtractText).to have_received(:new).with(no_args)
        expect(Receipts::Operations::ExtractReceiptDataOcrAi).to have_received(:new).with(no_args)

        # Ensure CreateTransactionFromReceipt is NOT called when auto_create_transaction is false
        expect(Receipts::Operations::CreateTransactionFromReceipt).not_to have_received(:new)
      end

      it "fails gracefully if optimize_image fails (uses original image path)" do
        # Stub the specific instance for this test
        allow(Receipts::Operations::OptimizeImage).to receive(:new) do |*args|
          instance_double("Receipts::Operations::OptimizeImage").tap do |op|
            allow(op).to receive(:call).and_return(Failure(optimization_error: "optimization error"))
          end
        end

        result = operation.call(params: params)
        expect(result).to be_success # It should still succeed by using the original image path
        expect(Receipts::Operations::OptimizeImage).to have_received(:new).with(no_args)
        expect(Receipts::Operations::ExtractText).to have_received(:new).with(no_args)

        # Ensure CreateTransactionFromReceipt is NOT called
        expect(Receipts::Operations::CreateTransactionFromReceipt).not_to have_received(:new)
      end

      it "fails if extract_text fails" do
        # Stub the specific instance for this test
        allow(Receipts::Operations::ExtractText).to receive(:new) do |*args|
          instance_double("Receipts::Operations::ExtractText").tap do |op|
            allow(op).to receive(:call).and_return(Failure(ocr_error: "ocr error"))
          end
        end
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:ocr_error)
      end

      it "fails if extract_text_from_result fails" do
        allow(operation).to receive(:extract_text_from_result).and_return(Failure(text_extraction_error: "no text"))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:text_extraction_error)
      end

      it "fails if extract_receipt_data_ocr_ai fails" do
        # Stub the specific instance for this test
        allow(Receipts::Operations::ExtractReceiptDataOcrAi).to receive(:new) do |*args|
          instance_double("Receipts::Operations::ExtractReceiptDataOcrAi").tap do |op|
            allow(op).to receive(:call).and_return(Failure(ai_extraction_error: "ai extraction error"))
          end
        end
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:ai_extraction_error)
      end
    end

    context "when determine_processing_method returns an unknown method" do
      it "returns a failure" do
        allow(operation).to receive(:determine_processing_method).and_return(Success("unknown_method"))
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to eq(processing_method_error: "Unknown processing method: unknown_method")
      end
    end
  end
end
