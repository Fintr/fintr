# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::FormatResult, type: :operation do
  subject(:operation) { described_class.new }

  let(:receipt_data_fixture) do
    {
      extracted_fields: {
        total_amount: { value: "100.00" },
        date: { value: Date.current.to_s },
        merchant: { value: "Whole Foods" }
      },
      suggested_category: "Groceries",
      extraction_metadata: {
        total_fields_found: 3,
        has_essential_data: true,
        extraction_timestamp: Time.current,
        processing_method: "test_method"
      }
    }
  end

  let(:confidence_analysis_fixture) do
    {
      overall_confidence: 0.9,
      reliability_assessment: {
        overall_level: :high
      },
      confidence_metadata: {
        needs_review: false,
        total_fields_analyzed: 3,
        high_confidence_fields: ["total_amount", "date", "merchant"]
      },
      recommendations: [],
      field_confidence: {
        total_amount: { enhanced_confidence: 0.95, reliability_level: :high, needs_review: false, visual_indicators: { color: "green" } },
        date: { enhanced_confidence: 0.9, reliability_level: :high, needs_review: false, visual_indicators: { color: "green" } },
        merchant: { enhanced_confidence: 0.85, reliability_level: :high, needs_review: false, visual_indicators: { color: "green" } }
      },
      validation_flags: {
        amount_valid: true,
        date_valid: true,
        merchant_valid: true
      }
    }
  end

  let(:ocr_text_fixture) { "Some OCR text for testing." }

  let(:params_fixture) do
    {
      receipt_data: receipt_data_fixture,
      confidence_analysis: confidence_analysis_fixture,
      ocr_text: ocr_text_fixture
    }
  end

  let(:formatted_extracted_data_mock) do
    {
      total_amount: { value: "100.00", confidence_score: 0.95, reliability: :high, needs_review: false, visual_indicators: { color: "green" } },
      date: { value: Date.current.to_s, confidence_score: 0.9, reliability: :high, needs_review: false, visual_indicators: { color: "green" } },
      merchant: { value: "Whole Foods", confidence_score: 0.85, reliability: :high, needs_review: false, visual_indicators: { color: "green" } },
      category: { value: "Groceries", confidence_score: 0.8, reliability: :high, needs_review: false, visual_indicators: { color: "green", icon: "✓", css_class: "confidence-high" } }
    }
  end

  let(:confidence_summary_mock) do
    {
      overall_score: 0.9,
      overall_level: :high,
      should_review: false,
      total_fields_found: 3,
      high_confidence_fields: ["total_amount", "date", "merchant"],
      recommendations: []
    }
  end

  let(:validation_flags_mock) do
    {
      amount_valid: true,
      date_valid: true,
      merchant_valid: true
    }
  end

  let(:raw_data_mock) do
    {
      processing_timestamp: Time.current
    }
  end

  let(:suggested_payload_mock) do
    {
      amount: 100.0,
      date: Date.current.to_s,
      category_name: "Groceries",
      account_name: "Credit Card",
      description: "Receipt from Whole Foods [Auto-processed from receipt]",
      schedule_type: "one_time"
    }
  end

  let(:final_formatted_result_mock) do
    {
      extracted_data: formatted_extracted_data_mock,
      confidence_summary: confidence_summary_mock,
      validation_flags: validation_flags_mock,
      suggested_transaction_payload: suggested_payload_mock,
      processing_timestamp: raw_data_mock[:processing_timestamp]
    }
  end

  before do
    allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
    allow(Time).to receive(:current).and_return(Time.parse("2023-01-01 10:00:00 UTC"))
  end

  describe "Contract" do
    context "with valid parameters" do
      it "is successful" do
        result = operation.validate(params: params_fixture)
        expect(result).to be_success
        expect(result.value!).to include(receipt_data: receipt_data_fixture, confidence_analysis: confidence_analysis_fixture, ocr_text: ocr_text_fixture)
      end
    end

    context "with invalid parameters" do
      it "fails when receipt_data is missing" do
        params = params_fixture.except(:receipt_data)
        result = operation.validate(params:)
        expect(result).to be_failure
        expect(result.failure).to include(receipt_data: ['is missing'])
      end

      it "fails when confidence_analysis is missing" do
        params = params_fixture.except(:confidence_analysis)
        result = operation.validate(params:)
        expect(result).to be_failure
        expect(result.failure).to include(confidence_analysis: ['is missing'])
      end

      it "fails when receipt_data is not a hash" do
        params = params_fixture.merge(receipt_data: "invalid")
        result = operation.validate(params:)
        expect(result).to be_failure
        expect(result.failure).to include(receipt_data: ['must be a hash'])
      end

      it "fails when confidence_analysis is not a hash" do
        params = params_fixture.merge(confidence_analysis: "invalid")
        result = operation.validate(params:)
        expect(result).to be_failure
        expect(result.failure).to include(confidence_analysis: ['must be a hash'])
      end

      it "is successful when ocr_text is missing" do
        params = params_fixture.except(:ocr_text)
        result = operation.validate(params:)
        expect(result).to be_success
      end

      it "fails when ocr_text is not a string if present" do
        params = params_fixture.merge(ocr_text: 123)
        result = operation.validate(params:)
        expect(result).to be_failure
        expect(result.failure).to include(ocr_text: ['must be a string'])
      end
    end
  end

  describe "#call" do
    before do
      allow(operation).to receive(:validate).and_return(Dry::Monads::Success(params_fixture))
      allow(operation).to receive(:format_extracted_data).and_return(Dry::Monads::Success(formatted_extracted_data_mock))
      allow(operation).to receive(:format_confidence_summary).and_return(Dry::Monads::Success(confidence_summary_mock))
      allow(operation).to receive(:extract_validation_flags).and_return(Dry::Monads::Success(validation_flags_mock))
      allow(operation).to receive(:prepare_raw_data).and_return(Dry::Monads::Success(raw_data_mock))
      allow(operation).to receive(:build_suggested_transaction_payload).and_return(Dry::Monads::Success(suggested_payload_mock))
      allow(operation).to receive(:prepare_formatted_result).and_return(Dry::Monads::Success(final_formatted_result_mock))
    end

    context "when all steps are successful" do
      it "returns a successful result with formatted data" do
        result = operation.call(params: params_fixture)
        expect(result).to be_success
        expect(result.value!).to eq(final_formatted_result_mock)
      end
    end

    context "when a step fails" do
      it "returns a failure if validate fails" do
        allow(operation).to receive(:validate).and_return(Dry::Monads::Failure(error: 'Validation failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Validation failed')
      end

      it "returns a failure if format_extracted_data fails" do
        allow(operation).to receive(:format_extracted_data).and_return(Dry::Monads::Failure(error: 'Extraction formatting failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Extraction formatting failed')
      end

      it "returns a failure if format_confidence_summary fails" do
        allow(operation).to receive(:format_confidence_summary).and_return(Dry::Monads::Failure(error: 'Confidence summary failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Confidence summary failed')
      end

      it "returns a failure if extract_validation_flags fails" do
        allow(operation).to receive(:extract_validation_flags).and_return(Dry::Monads::Failure(error: 'Validation flags extraction failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Validation flags extraction failed')
      end

      it "returns a failure if prepare_raw_data fails" do
        allow(operation).to receive(:prepare_raw_data).and_return(Dry::Monads::Failure(error: 'Raw data preparation failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Raw data preparation failed')
      end

      it "returns a failure if build_suggested_transaction_payload fails" do
        allow(operation).to receive(:build_suggested_transaction_payload).and_return(Dry::Monads::Failure(error: 'Payload building failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Payload building failed')
      end

      it "returns a failure if prepare_formatted_result fails" do
        allow(operation).to receive(:prepare_formatted_result).and_return(Dry::Monads::Failure(error: 'Final result preparation failed'))
        result = operation.call(params: params_fixture)
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Final result preparation failed')
      end
    end
  end

  describe "Private Methods" do
    describe "#format_extracted_data" do
      context "with valid receipt data and confidence analysis" do
        it "formats extracted data with confidence information" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: receipt_data_fixture, confidence_analysis: confidence_analysis_fixture }
          )
          expect(result).to be_success
          formatted_data = result.value!

          expect(formatted_data[:total_amount]).to include(
            value: "100.00",
            confidence_score: 0.95,
            reliability: :high,
            needs_review: false,
            visual_indicators: { color: "green" }
          )
          expect(formatted_data[:date]).to include(
            value: Date.current.to_s,
            confidence_score: 0.9,
            reliability: :high,
            needs_review: false,
            visual_indicators: { color: "green" }
          )
          expect(formatted_data[:merchant]).to include(
            value: "Whole Foods",
            confidence_score: 0.85,
            reliability: :high,
            needs_review: false,
            visual_indicators: { color: "green" }
          )
          expect(formatted_data[:category]).to include(
            value: "Groceries",
            confidence_score: 0.8,
            reliability: :high,
            needs_review: false,
            visual_indicators: { color: "green", icon: "✓", css_class: "confidence-high" }
          )
        end
      end

      context "when receipt_data is nil" do
        it "returns a failure" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: nil, confidence_analysis: confidence_analysis_fixture }
          )
          expect(result).to be_failure
          expect(result.failure).to eq("Receipt data is missing")
        end
      end

      context "when confidence_analysis is nil" do
        it "returns a failure" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: receipt_data_fixture, confidence_analysis: nil }
          )
          expect(result).to be_failure
          expect(result.failure).to eq("Confidence analysis is missing")
        end
      end

      context "when extracted_fields are missing from receipt_data" do
        let(:invalid_receipt_data) { receipt_data_fixture.except(:extracted_fields) }

        it "returns a failure" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: invalid_receipt_data, confidence_analysis: confidence_analysis_fixture }
          )
          expect(result).to be_failure
          expect(result.failure).to eq("Extracted fields are missing")
        end
      end

      context "when field_confidence is missing from confidence_analysis" do
        let(:invalid_confidence_analysis) { confidence_analysis_fixture.except(:field_confidence) }

        it "returns a failure" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: receipt_data_fixture, confidence_analysis: invalid_confidence_analysis }
          )
          expect(result).to be_failure
          expect(result.failure).to eq("Field confidence data is missing")
        end
      end

      context "when suggested_category is present but category field already exists" do
        let(:receipt_data_with_category) do
          receipt_data_fixture.deep_merge(
            extracted_fields: { category: { value: "Existing Category" } }
          )
        end

        it "does not override the existing category field" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: receipt_data_with_category, confidence_analysis: confidence_analysis_fixture }
          )
          expect(result).to be_success
          formatted_data = result.value!
          expect(formatted_data[:category][:value]).to eq("Existing Category")
          expect(formatted_data[:category][:confidence_score]).to be_nil # No confidence from analysis fixture
          expect(formatted_data[:category][:reliability]).to be_nil
          expect(formatted_data[:category][:needs_review]).to be_nil
          expect(formatted_data[:category][:visual_indicators]).to be_nil
        end
      end

      context "when a field has no confidence info" do
        let(:confidence_analysis_partial) do
          confidence_analysis_fixture.merge(
            field_confidence: { total_amount: { enhanced_confidence: 0.9, reliability_level: :medium, needs_review: true, visual_indicators: { color: "yellow" } } } # Only total_amount present
          )
        end

        it "includes fields without confidence info but with nil confidence values" do
          result = operation.__send__(
            :format_extracted_data,
            params: { receipt_data: receipt_data_fixture, confidence_analysis: confidence_analysis_partial }
          )
          expect(result).to be_success
          formatted_data = result.value!

          expect(formatted_data).to have_key(:total_amount)
          expect(formatted_data[:total_amount]).to include(
            value: "100.00",
            confidence_score: 0.9,
            reliability: :medium,
            needs_review: true,
            visual_indicators: { color: "yellow" }
          )

          expect(formatted_data).to have_key(:date)
          expect(formatted_data[:date][:value]).to eq(Date.current.to_s)
          expect(formatted_data[:date][:confidence_score]).to be_nil
          expect(formatted_data[:date][:reliability]).to be_nil
          expect(formatted_data[:date][:needs_review]).to be_nil
          expect(formatted_data[:date][:visual_indicators]).to be_nil

          expect(formatted_data).to have_key(:merchant)
          expect(formatted_data[:merchant][:value]).to eq("Whole Foods")
          expect(formatted_data[:merchant][:confidence_score]).to be_nil
          expect(formatted_data[:merchant][:reliability]).to be_nil
          expect(formatted_data[:merchant][:needs_review]).to be_nil
          expect(formatted_data[:merchant][:visual_indicators]).to be_nil

          expect(formatted_data).to have_key(:category)
          expect(formatted_data[:category][:value]).to eq("Groceries")
          expect(formatted_data[:category][:confidence_score]).to eq(0.8)
        end
      end
    end

    describe "#format_confidence_summary" do
      it "formats confidence summary correctly" do
        result = operation.__send__(
          :format_confidence_summary,
          params: { confidence_analysis: confidence_analysis_fixture }
        )
        expect(result).to be_success
        summary = result.value!
        expect(summary).to eq(
          overall_score: 0.9,
          overall_level: :high,
          should_review: false,
          total_fields_found: 3,
          high_confidence_fields: ["total_amount", "date", "merchant"],
          recommendations: []
        )
      end
    end

    describe "#extract_validation_flags" do
      it "extracts validation flags correctly" do
        result = operation.__send__(
          :extract_validation_flags,
          params: { confidence_analysis: confidence_analysis_fixture }
        )
        expect(result).to be_success
        flags = result.value!
        expect(flags).to eq(
          amount_valid: true,
          date_valid: true,
          merchant_valid: true
        )
      end
    end

    describe "#prepare_raw_data" do
      it "prepares raw data with processing timestamp" do
        result = operation.__send__(:prepare_raw_data, params: params_fixture)
        expect(result).to be_success
        raw_data = result.value!
        expect(raw_data).to eq(
          processing_timestamp: Time.current
        )
      end
    end

    describe "#build_suggested_transaction_payload" do
      context "with extracted data" do
        it "builds suggested transaction payload correctly" do
          result = operation.__send__(
            :build_suggested_transaction_payload,
            extracted_data: formatted_extracted_data_mock
          )
          expect(result).to be_success
          payload = result.value!
          expect(payload).to eq(
            amount: 100.0,
            date: Date.current.to_s,
            category_name: "Groceries",
            account_name: "Credit Card",
            description: "Receipt from Whole Foods [Auto-processed from receipt]",
            schedule_type: "one_time"
          )
        end
      end

      context "with nil extracted data" do
        it "returns default transaction payload" do
          result = operation.__send__(
            :build_suggested_transaction_payload,
            extracted_data: nil
          )
          expect(result).to be_success
          payload = result.value!
          expect(payload).to eq(operation.__send__(:default_transaction_payload))
        end
      end
    end

    describe "#default_transaction_payload" do
      it "returns the default transaction payload" do
        payload = operation.__send__(:default_transaction_payload)
        expect(payload).to eq(
          amount: 0.0,
          date: Date.current.to_s,
          category_name: "Family",
          account_name: "Credit Card",
          description: "Receipt transaction [Auto-processed from receipt]",
          schedule_type: "one_time"
        )
      end
    end

    describe "#extract_amount_value" do
      context "when total_amount is present" do
        let(:data) { { total_amount: { value: "150.75" } } }

        it "extracts the amount value" do
          expect(operation.__send__(:extract_amount_value, data)).to eq(150.75)
        end
      end

      context "when total_amount is missing" do
        let(:data) { {} }

        it "returns 0.0" do
          expect(operation.__send__(:extract_amount_value, data)).to eq(0.0)
        end
      end

      context "when extracted_data is nil" do
        it "returns 0.0" do
          expect(operation.__send__(:extract_amount_value, nil)).to eq(0.0)
        end
      end
    end

    describe "#extract_category_value" do
      context "when category is present" do
        let(:data) { { category: { value: "Shopping" } } }

        it "extracts the category value" do
          expect(operation.__send__(:extract_category_value, data)).to eq("Shopping")
        end
      end

      context "when category is missing" do
        let(:data) { {} }

        it "returns default category 'Family'" do
          expect(operation.__send__(:extract_category_value, data)).to eq("Family")
        end
      end

      context "when extracted_data is nil" do
        it "returns default category 'Family'" do
          expect(operation.__send__(:extract_category_value, nil)).to eq("Family")
        end
      end
    end

    describe "#build_description" do
      context "when merchant is present" do
        let(:data) { { merchant: { value: "Starbucks" } } }

        it "builds description with merchant name" do
          expect(operation.__send__(:build_description, data)).to eq("Receipt from Starbucks [Auto-processed from receipt]")
        end
      end

      context "when merchant is missing" do
        let(:data) { {} }

        it "builds generic description" do
          expect(operation.__send__(:build_description, data)).to eq("Receipt transaction [Auto-processed from receipt]")
        end
      end

      context "when extracted_data is nil" do
        it "builds generic description" do
          expect(operation.__send__(:build_description, nil)).to eq("Receipt transaction [Auto-processed from receipt]")
        end
      end
    end

    describe "#prepare_formatted_result" do
      let(:extracted_data_prep) { { field1: "value1" } }
      let(:confidence_summary_prep) { { score: 0.9 } }
      let(:validation_flags_prep) { { valid: true } }
      let(:suggested_payload_prep) { { amount: 100 } }
      let(:raw_data_prep) { { processing_timestamp: Time.current } }

      it "prepares the final formatted result hash" do
        result = operation.__send__(
          :prepare_formatted_result,
          extracted_data: extracted_data_prep,
          confidence_summary: confidence_summary_prep,
          validation_flags: validation_flags_prep,
          raw_data: raw_data_prep,
          suggested_payload: suggested_payload_prep
        )
        expect(result).to be_success
        expect(result.value!).to eq(
          extracted_data: extracted_data_prep,
          confidence_summary: confidence_summary_prep,
          validation_flags: validation_flags_prep,
          suggested_transaction_payload: suggested_payload_prep,
          processing_timestamp: raw_data_prep[:processing_timestamp]
        )
      end
    end
  end
end
