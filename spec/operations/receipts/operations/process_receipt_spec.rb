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
        auto_create_transaction: false
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
  end

  describe "#call" do
    let(:params) do
      {
        user_id: user_id,
        space_id: space_id,
        image_path: image_path,
        auto_create_transaction: false
      }
    end

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
      # Stub sub-operations for pure AI processing
      allow(Receipts::Operations::ExtractReceiptDataVision).to receive(:new) do |*args|
        instance_double(Receipts::Operations::ExtractReceiptDataVision).tap do |op|
          allow(op).to receive(:call).and_return(extracted_data_success)
        end
      end

      allow(Receipts::Operations::CalculateConfidenceAi).to receive(:new) do |*args|
        instance_double(Receipts::Operations::CalculateConfidenceAi).tap do |op|
          allow(op).to receive(:call).and_return(confidence_analysis_success)
        end
      end

      allow(Receipts::Operations::FormatResult).to receive(:new) do |*args|
        instance_double(Receipts::Operations::FormatResult).tap do |op|
          allow(op).to receive(:call).and_return(formatted_result_success)
        end
      end

      # Explicitly allow new and call_original for CreateTransactionFromReceipt to enable spying.
      allow(Receipts::Operations::CreateTransactionFromReceipt).to receive(:new).and_call_original
    end

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
        instance_double(Receipts::Operations::CalculateConfidenceAi).tap do |op|
          allow(op).to receive(:call).and_return(confidence_analysis_success_no_review)
        end
      end

      # Stub CreateTransactionFromReceipt specifically for this test to return success
      create_transaction_from_receipt_double = instance_double(Receipts::Operations::CreateTransactionFromReceipt)
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
        instance_double(Receipts::Operations::CalculateConfidenceAi).tap do |op|
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
        instance_double(Receipts::Operations::FormatResult).tap do |op|
          allow(op).to receive(:call).and_return(formatted_result_needs_review)
        end
      end

      result = operation.call(params: params)
      expect(result).to be_success
      expect(result.value![:transaction]).to be_nil
    end

    it "fails if extract_receipt_data_vision fails" do
      allow(Receipts::Operations::ExtractReceiptDataVision).to receive(:new) do |*args|
        instance_double(Receipts::Operations::ExtractReceiptDataVision).tap do |op|
          allow(op).to receive(:call).and_return(Failure(process_error: "error"))
        end
      end
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:process_error)
    end

    it "fails if calculate_confidence_vision fails" do
      allow(Receipts::Operations::CalculateConfidenceAi).to receive(:new) do |*args|
        instance_double(Receipts::Operations::CalculateConfidenceAi).tap do |op|
          allow(op).to receive(:call).and_return(Failure(confidence_error: "error"))
        end
      end
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:confidence_error)
    end

    it "fails if format_result fails" do
      allow(Receipts::Operations::FormatResult).to receive(:new) do |*args|
        instance_double(Receipts::Operations::FormatResult).tap do |op|
          allow(op).to receive(:call).and_return(Failure(format_error: "error"))
        end
      end
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:format_error)
    end

    it "returns success even if create_transaction_if_requested fails, but transaction is nil" do
      params[:auto_create_transaction] = true
      # Stub the specific instance for this test to return failure
      create_transaction_from_receipt_double = instance_double(Receipts::Operations::CreateTransactionFromReceipt)
      allow(Receipts::Operations::CreateTransactionFromReceipt).to receive(:new).and_return(create_transaction_from_receipt_double)
      allow(create_transaction_from_receipt_double).to receive(:call).and_return(Failure(transaction_error: "transaction error"))

      result = operation.call(params: params)
      expect(result).to be_success
      expect(result.value![:transaction]).to be_nil
    end
  end
end
