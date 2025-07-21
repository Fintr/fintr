# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::CalculateConfidenceAi, type: :operation do
  subject(:operation) { described_class.new }

  let(:receipt_data) do
    {
      extracted_fields: {
        total_amount: { value: "123.45", confidence_score: 0.8 },
        category: { value: "Groceries", confidence_score: 0.7 },
        merchant: { value: "SuperMart", confidence_score: 0.9 }
      }
    }
  end
  let(:ocr_text) { "Scanned receipt text with details" }

  describe "Contract" do
    let(:params) do
      {
        receipt_data: receipt_data,
        ocr_text: ocr_text
      }
    end

    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "fails if receipt_data is missing" do
      params.delete(:receipt_data)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:receipt_data)
    end

    it "fails if ocr_text is missing" do
      params.delete(:ocr_text)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:ocr_text)
    end

    it "fails if receipt_data does not contain extracted_fields" do
      params[:receipt_data] = { other_key: "value" }
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:receipt_data)
      expect(result.failure[:receipt_data]).to include("must contain extracted_fields")
    end

    it "fails if receipt_data is not a hash" do
      params[:receipt_data] = "not a hash"
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:receipt_data)
    end

    it "fails if ocr_text is not a string" do
      params[:ocr_text] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:ocr_text)
    end
  end

  describe "#call" do
    let(:params) do
      {
        receipt_data: receipt_data,
        ocr_text: ocr_text
      }
    end

    # Mock all internal step methods to isolate #call's orchestration logic
    before do
      allow(operation).to receive(:validate).and_return(Success(params))
      allow(operation).to receive(:calculate_field_confidence).and_return(Success(field_confidence_result))
      allow(operation).to receive(:calculate_overall_confidence).and_return(Success(overall_confidence_score))
      allow(operation).to receive(:assess_reliability).and_return(Success(reliability_assessment_result))
      allow(operation).to receive(:generate_validation_flags).and_return(Success(validation_flags_result))
      allow(operation).to receive(:generate_recommendations).and_return(Success(recommendations_result))
      allow(operation).to receive(:prepare_confidence_result).and_return(Success(final_confidence_result))
    end

    let(:field_confidence_result) do
      {
        total_amount: { base_confidence: 0.8, enhanced_confidence: 0.88, reliability_level: :high, needs_review: false, visual_indicators: { color: "green", icon: "✓", css_class: "confidence-high" } },
        category: { base_confidence: 0.7, enhanced_confidence: 0.8, reliability_level: :high, needs_review: false, visual_indicators: { color: "green", icon: "✓", css_class: "confidence-high" } }
      }
    end
    let(:overall_confidence_score) { 0.85 }
    let(:reliability_assessment_result) { { overall_level: :high, critical_fields_present: true, field_consistency: :consistent, processing_quality: :excellent } }
    let(:validation_flags_result) { { reasonable_amount: true, valid_category: true, complete_data: true, high_confidence_extraction: true, ai_processing_successful: true, suggest_retry: false, recommend_manual_entry: false } }
    let(:recommendations_result) { ["AI extraction successful", "Data looks accurate, safe to proceed"] }
    let(:final_confidence_result) do
      {
        field_confidence: field_confidence_result,
        overall_confidence: overall_confidence_score,
        reliability_assessment: reliability_assessment_result,
        validation_flags: validation_flags_result,
        recommendations: recommendations_result,
        confidence_metadata: {
          total_fields_analyzed: 2,
          high_confidence_fields: 2,
          needs_review: false
        }
      }
    end

    it "orchestrates the confidence calculation steps and returns a successful result" do
      result = operation.call(params: params)
      expect(result).to be_success
      expect(result.value!).to eq(final_confidence_result)

      expect(operation).to have_received(:validate).with(params: params)
      expect(operation).to have_received(:calculate_field_confidence).with(params: params)
      expect(operation).to have_received(:calculate_overall_confidence).with(field_confidence: field_confidence_result)
      expect(operation).to have_received(:assess_reliability).with(field_confidence: field_confidence_result, overall_confidence: overall_confidence_score)
      expect(operation).to have_received(:generate_validation_flags).with(params: params, field_confidence: field_confidence_result)
      expect(operation).to have_received(:generate_recommendations).with(
        field_confidence: field_confidence_result,
        overall_confidence: overall_confidence_score,
        validation_flags: validation_flags_result
      )
      expect(operation).to have_received(:prepare_confidence_result).with(
        field_confidence: field_confidence_result,
        overall_confidence: overall_confidence_score,
        reliability_assessment: reliability_assessment_result,
        validation_flags: validation_flags_result,
        recommendations: recommendations_result
      )
    end

    it "returns a failure if any step fails" do
      allow(operation).to receive(:calculate_field_confidence).and_return(Failure(field_error: "Field calculation failed"))
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:field_error)
    end
  end

  context "private methods" do
    let(:extracted_fields) do
      {
        total_amount: { value: "123.45", confidence_score: 0.8 },
        category: { value: "Groceries", confidence_score: 0.7 },
        merchant: { value: "SuperMart", confidence_score: 0.9 }
      }
    end

    describe "#calculate_field_confidence" do
      it "returns a failure if receipt_data is nil" do
        params = { receipt_data: nil, ocr_text: ocr_text }
        result = operation.send(:calculate_field_confidence, params: params)
        expect(result).to be_failure
        expect(result.failure).to eq("Receipt data is missing")
      end

      it "returns a failure if extracted_fields is nil" do
        params = { receipt_data: { extracted_fields: nil }, ocr_text: ocr_text }
        result = operation.send(:calculate_field_confidence, params: params)
        expect(result).to be_failure
        expect(result.failure).to eq("Extracted fields are missing")
      end

      it "returns an empty hash if extracted_fields is empty" do
        params = { receipt_data: { extracted_fields: {} }, ocr_text: ocr_text }
        result = operation.send(:calculate_field_confidence, params: params)
        expect(result).to be_success
        expect(result.value!).to be_empty
      end

      it "calculates enhanced confidence and indicators for each field" do
        params = { receipt_data: receipt_data, ocr_text: ocr_text }

        # Mock private methods called by calculate_field_confidence to control their output
        allow(operation).to receive(:enhance_ai_confidence) do |field_name, field_data, _ocr_text, base_score|
          # Simplified enhancement for testing
          if field_name == :total_amount
            base_score + 0.08 # Example boost
          elsif field_name == :category
            base_score + 0.1 # Example boost
          else
            base_score + 0.05 # General boost
          end
        end
        allow(operation).to receive(:determine_reliability_level).and_return(:high)
        allow(operation).to receive(:generate_visual_indicators).and_return({ color: "green", icon: "✓", css_class: "confidence-high" })

        result = operation.send(:calculate_field_confidence, params: params)
        expect(result).to be_success
        field_scores = result.value!

        expect(field_scores[:total_amount]).to include(
          base_confidence: 0.8,
          enhanced_confidence: (0.8 + 0.08).round(3),
          reliability_level: :high,
          needs_review: false
        )
        expect(field_scores[:category]).to include(
          base_confidence: 0.7,
          enhanced_confidence: (0.7 + 0.1).round(3),
          reliability_level: :high,
          needs_review: false
        )
        expect(field_scores[:merchant]).to include(
          base_confidence: 0.9,
          enhanced_confidence: (0.9 + 0.05).round(3),
          reliability_level: :high,
          needs_review: false
        )
      end

      it "sets needs_review to true if enhanced_score is below 0.7" do
        low_confidence_data = {
          extracted_fields: {
            total_amount: { value: "10.00", confidence_score: 0.5 }
          }
        }
        params = { receipt_data: low_confidence_data, ocr_text: ocr_text }

        allow(operation).to receive(:enhance_ai_confidence).and_return(0.65) # Simulating a score below 0.7
        allow(operation).to receive(:determine_reliability_level).and_return(:medium)
        allow(operation).to receive(:generate_visual_indicators).and_return({ color: "yellow", icon: "?", css_class: "confidence-medium" })

        result = operation.send(:calculate_field_confidence, params: params)
        expect(result).to be_success
        expect(result.value![:total_amount][:needs_review]).to be true
      end
    end

    describe "#enhance_ai_confidence" do
      let(:field_data) { { value: "any_value" } }
      let(:base_score) { 0.5 }

      it "adds a general boost of 0.05" do
        score = operation.send(:enhance_ai_confidence, :some_field, field_data, ocr_text, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.05)
      end

      it "calls enhance_ai_amount_confidence for total_amount" do
        expect(operation).to receive(:enhance_ai_amount_confidence).and_call_original
        operation.send(:enhance_ai_confidence, :total_amount, field_data, ocr_text, base_score)
      end

      it "calls enhance_ai_category_confidence for category" do
        expect(operation).to receive(:enhance_ai_category_confidence).and_call_original
        operation.send(:enhance_ai_confidence, :category, field_data, ocr_text, base_score)
      end

      it "caps the score at 1.0" do
        field_data = { value: "100.00" }
        base_score = 0.98
        score = operation.send(:enhance_ai_confidence, :total_amount, field_data, ocr_text, base_score)
        expect(score).to eq(1.0)
      end
    end

    describe "#enhance_ai_amount_confidence" do
      let(:base_score) { 0.5 }

      it "adds 0.1 for amounts between 1 and 1000" do
        field_data = { value: "123.45" }
        score = operation.send(:enhance_ai_amount_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.1 + 0.05) # +0.05 for AI trust
      end

      it "adds 0.05 for amounts between 0.50 and 5000 (if not already boosted by 0.1)" do
        # Test an amount that only gets the 0.05 boost (e.g., just outside 1-1000 range)
        field_data = { value: "0.75" }
        score = operation.send(:enhance_ai_amount_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.05 + 0.05) # +0.05 for range, +0.05 for AI trust

        field_data = { value: "2000.00" }
        score = operation.send(:enhance_ai_amount_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.1 + 0.05) # gets both 0.1 and 0.05 boosts
      end

      it "deducts 0.2 for amounts greater than 10000 or less than 0.10" do
        field_data = { value: "15000.00" }
        score = operation.send(:enhance_ai_amount_confidence, field_data, base_score)
        # It will get +0.1 for 1-1000 and +0.05 for 0.5-5000, then -0.2 and +0.05 for AI trust
        # So, 0.5 + 0.1 + 0.05 - 0.2 + 0.05 = 0.5
        expect(score).to be_within(0.001).of(base_score + 0.1 + 0.05 - 0.2 + 0.05)

        field_data = { value: "0.05" }
        score = operation.send(:enhance_ai_amount_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score - 0.2 + 0.05) # only -0.2 and +0.05 AI trust
      end

      it "adds 0.05 for AI trust" do
        field_data = { value: "1.00" }
        score = operation.send(:enhance_ai_amount_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.1 + 0.05) # 0.5 + 0.1 + 0.05 = 0.65
      end
    end

    describe "#enhance_ai_category_confidence" do
      let(:base_score) { 0.5 }
      let(:valid_categories) { ["Family", "Gas", "Food", "Health", "Shopping"] }

      before do
        # Stub valid_categories to ensure consistent test results
        # This is not a method, but a hardcoded list in the source, so we can't stub it directly.
        # Instead, make sure test data aligns with it.
      end

      it "adds 0.1 for a valid category" do
        field_data = { value: "Food" }
        score = operation.send(:enhance_ai_category_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.1 + 0.1) # +0.1 for valid, +0.1 for AI reliable
      end

      it "does not add 0.1 for an invalid category" do
        field_data = { value: "Unknown" }
        score = operation.send(:enhance_ai_category_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.1) # Only +0.1 for AI reliable
      end

      it "adds a general boost of 0.1 for AI categorization reliability" do
        field_data = { value: "AnyCategory" }
        score = operation.send(:enhance_ai_category_confidence, field_data, base_score)
        expect(score).to be_within(0.001).of(base_score + 0.1) # Only +0.1 for AI reliable if not a valid category
      end
    end

    describe "#determine_reliability_level" do
      it "returns :high for scores between 0.8 and 1.0" do
        expect(operation.send(:determine_reliability_level, 0.8)).to eq(:high)
        expect(operation.send(:determine_reliability_level, 0.95)).to eq(:high)
        expect(operation.send(:determine_reliability_level, 1.0)).to eq(:high)
      end

      it "returns :medium for scores between 0.6 and 0.8 (exclusive of 0.8)" do
        expect(operation.send(:determine_reliability_level, 0.6)).to eq(:medium)
        expect(operation.send(:determine_reliability_level, 0.79)).to eq(:medium)
      end

      it "returns :low for scores between 0.4 and 0.6 (exclusive of 0.6)" do
        expect(operation.send(:determine_reliability_level, 0.4)).to eq(:low)
        expect(operation.send(:determine_reliability_level, 0.59)).to eq(:low)
      end

      it "returns :very_low for scores below 0.4" do
        expect(operation.send(:determine_reliability_level, 0.39)).to eq(:very_low)
        expect(operation.send(:determine_reliability_level, 0.0)).to eq(:very_low)
      end
    end

    describe "#generate_visual_indicators" do
      it "generates correct indicators for high confidence" do
        allow(operation).to receive(:determine_reliability_level).and_return(:high)
        indicators = operation.send(:generate_visual_indicators, 0.9)
        expect(indicators).to include(color: "green", icon: "✓", css_class: "confidence-high")
      end

      it "generates correct indicators for medium confidence" do
        allow(operation).to receive(:determine_reliability_level).and_return(:medium)
        indicators = operation.send(:generate_visual_indicators, 0.7)
        expect(indicators).to include(color: "yellow", icon: "?", css_class: "confidence-medium")
      end
    end

    describe "#confidence_color" do
      it "returns green for high scores" do
        expect(operation.send(:confidence_color, 0.85)).to eq("green")
      end

      it "returns yellow for medium scores" do
        expect(operation.send(:confidence_color, 0.65)).to eq("yellow")
      end

      it "returns orange for low scores" do
        expect(operation.send(:confidence_color, 0.45)).to eq("orange")
      end

      it "returns red for very low scores" do
        expect(operation.send(:confidence_color, 0.3)).to eq("red")
      end
    end

    describe "#confidence_icon" do
      it "returns ✓ for high scores" do
        expect(operation.send(:confidence_icon, 0.85)).to eq("✓")
      end

      it "returns ? for medium scores" do
        expect(operation.send(:confidence_icon, 0.65)).to eq("?")
      end

      it "returns ⚠ for low scores" do
        expect(operation.send(:confidence_icon, 0.45)).to eq("⚠")
      end

      it "returns ✗ for very low scores" do
        expect(operation.send(:confidence_icon, 0.3)).to eq("✗")
      end
    end

    describe "#calculate_overall_confidence" do
      it "calculates weighted average based on field confidence" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.9 },
          category: { enhanced_confidence: 0.7 },
          merchant: { enhanced_confidence: 0.5 } # This field has no weight
        }
        # (0.9 * 0.6) + (0.7 * 0.4) = 0.54 + 0.28 = 0.82
        # Total weight = 0.6 + 0.4 = 1.0
        # Overall = 0.82 / 1.0 = 0.82
        result = operation.send(:calculate_overall_confidence, field_confidence: field_conf)
        expect(result).to be_success
        expect(result.value!).to be_within(0.001).of(0.82)
      end

      it "returns 0.0 if field_confidence is empty" do
        result = operation.send(:calculate_overall_confidence, field_confidence: {})
        expect(result).to be_success
        expect(result.value!).to eq(0.0)
      end

      it "handles cases where only one weighted field is present" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.8 },
          merchant: { enhanced_confidence: 0.5 } # No weight
        }
        # (0.8 * 0.6) / 0.6 = 0.8
        result = operation.send(:calculate_overall_confidence, field_confidence: field_conf)
        expect(result).to be_success
        expect(result.value!).to be_within(0.001).of(0.8)
      end
    end

    describe "#assess_reliability" do
      let(:overall_confidence) { 0.75 }

      it "assesses reliability correctly for typical scenario" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.85 },
          category: { enhanced_confidence: 0.7 }
        }
        result = operation.send(:assess_reliability, field_confidence: field_conf, overall_confidence: overall_confidence)
        expect(result).to be_success
        expect(result.value!).to include(
          overall_level: :medium, # 0.75 is medium
          critical_fields_present: true,
          field_consistency: :consistent,
          processing_quality: :good # 1 high confidence / 2 total fields = 0.5
        )
      end

      it "sets critical_fields_present to false if neither total_amount nor category are present" do
        field_conf = {
          merchant: { enhanced_confidence: 0.9 }
        }
        result = operation.send(:assess_reliability, field_confidence: field_conf, overall_confidence: overall_confidence)
        expect(result).to be_success
        expect(result.value![:critical_fields_present]).to be false
      end

      it "assess_ai_processing_quality returns :excellent" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.9 },
          category: { enhanced_confidence: 0.85 }
        }
        result = operation.send(:assess_reliability, field_confidence: field_conf, overall_confidence: overall_confidence)
        expect(result).to be_success
        expect(result.value![:processing_quality]).to eq(:excellent)
      end

      it "assess_ai_processing_quality returns :good" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.9 },
          category: { enhanced_confidence: 0.6 }
        }
        result = operation.send(:assess_reliability, field_confidence: field_conf, overall_confidence: overall_confidence)
        expect(result).to be_success
        expect(result.value![:processing_quality]).to eq(:good)
      end

      it "assess_ai_processing_quality returns :fair" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.4 },
          category: { enhanced_confidence: 0.3 }
        }
        result = operation.send(:assess_reliability, field_confidence: field_conf, overall_confidence: overall_confidence)
        expect(result).to be_success
        expect(result.value![:processing_quality]).to eq(:fair)
      end

      it "assess_ai_processing_quality returns :poor for empty fields" do
        field_conf = {}
        result = operation.send(:assess_reliability, field_confidence: field_conf, overall_confidence: overall_confidence)
        expect(result).to be_success
        expect(result.value![:processing_quality]).to eq(:poor)
      end
    end

    describe "#has_critical_fields?" do
      it "returns true if total_amount is present" do
        fields = { total_amount: { value: "10.00" } }
        expect(operation.send(:has_critical_fields?, fields)).to be true
      end

      it "returns true if category is present" do
        fields = { category: { value: "Food" } }
        expect(operation.send(:has_critical_fields?, fields)).to be true
      end

      it "returns false if neither total_amount nor category are present" do
        fields = { merchant: { value: "Store" } }
        expect(operation.send(:has_critical_fields?, fields)).to be false
      end

      it "returns false if fields are empty" do
        expect(operation.send(:has_critical_fields?, {})).to be false
      end
    end

    describe "#generate_validation_flags" do
      it "generates correct flags for a high-confidence scenario" do
        params = { receipt_data: receipt_data, ocr_text: ocr_text }
        field_conf = {
          total_amount: { enhanced_confidence: 0.9, value: "100.00" },
          category: { enhanced_confidence: 0.8, value: "Groceries" }
        }
        allow(operation).to receive(:validate_reasonable_amount).and_return(true)
        allow(operation).to receive(:validate_category_presence).and_return(true)
        allow(operation).to receive(:validate_data_completeness).and_return(true)
        allow(operation).to receive(:validate_high_confidence).and_return(true)
        allow(operation).to receive(:should_suggest_retry?).and_return(false)
        allow(operation).to receive(:should_recommend_manual?).and_return(false)

        result = operation.send(:generate_validation_flags, params: params, field_confidence: field_conf)
        expect(result).to be_success
        expect(result.value!).to include(
          reasonable_amount: true,
          valid_category: true,
          complete_data: true,
          high_confidence_extraction: true,
          ai_processing_successful: true,
          suggest_retry: false,
          recommend_manual_entry: false
        )
      end

      it "sets flags correctly for a low-confidence scenario requiring retry" do
        params = { receipt_data: receipt_data, ocr_text: ocr_text }
        field_conf = {
          total_amount: { enhanced_confidence: 0.3, value: "1.00" },
          category: { enhanced_confidence: 0.2, value: "Family" }
        }
        allow(operation).to receive(:validate_reasonable_amount).and_return(true)
        allow(operation).to receive(:validate_category_presence).and_return(true)
        allow(operation).to receive(:validate_data_completeness).and_return(true)
        allow(operation).to receive(:validate_high_confidence).and_return(false)
        allow(operation).to receive(:should_suggest_retry?).and_return(true)
        allow(operation).to receive(:should_recommend_manual?).and_return(false)

        result = operation.send(:generate_validation_flags, params: params, field_confidence: field_conf)
        expect(result).to be_success
        expect(result.value![:suggest_retry]).to be true
        expect(result.value![:high_confidence_extraction]).to be false
      end
    end

    describe "#validate_reasonable_amount" do
      it "returns true for amounts within reasonable range" do
        fields = { total_amount: { value: "100.00" } }
        expect(operation.send(:validate_reasonable_amount, fields)).to be true
        fields = { total_amount: { value: "0.10" } }
        expect(operation.send(:validate_reasonable_amount, fields)).to be true
        fields = { total_amount: { value: "50000.00" } }
        expect(operation.send(:validate_reasonable_amount, fields)).to be true
      end

      it "returns false for amounts outside reasonable range" do
        fields = { total_amount: { value: "0.05" } }
        expect(operation.send(:validate_reasonable_amount, fields)).to be false
        fields = { total_amount: { value: "50000.01" } }
        expect(operation.send(:validate_reasonable_amount, fields)).to be false
      end

      it "returns false if total_amount is missing" do
        fields = { category: { value: "Food" } }
        expect(operation.send(:validate_reasonable_amount, fields)).to be false
      end
    end

    describe "#validate_category_presence" do
      it "returns true if category is present and has a value" do
        fields = { category: { value: "Food" } }
        expect(operation.send(:validate_category_presence, fields)).to be true
      end

      it "returns false if category is missing" do
        fields = { total_amount: { value: "10.00" } }
        expect(operation.send(:validate_category_presence, fields)).to be false
      end

      it "returns false if category has a blank value" do
        fields = { category: { value: "" } }
        expect(operation.send(:validate_category_presence, fields)).to be false
      end
    end

    describe "#validate_data_completeness" do
      it "returns true if both total_amount and category are present" do
        fields = { total_amount: { value: "10.00" }, category: { value: "Food" } }
        expect(operation.send(:validate_data_completeness, fields)).to be true
      end

      it "returns false if total_amount is missing" do
        fields = { category: { value: "Food" } }
        expect(operation.send(:validate_data_completeness, fields)).to be false
      end

      it "returns false if category is missing" do
        fields = { total_amount: { value: "10.00" } }
        expect(operation.send(:validate_data_completeness, fields)).to be false
      end

      it "returns false if both are missing" do
        fields = { merchant: { value: "Store" } }
        expect(operation.send(:validate_data_completeness, fields)).to be false
      end
    end

    describe "#validate_high_confidence" do
      it "returns true if any field has enhanced_confidence >= 0.7" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.6 },
          category: { enhanced_confidence: 0.75 }
        }
        expect(operation.send(:validate_high_confidence, field_conf)).to be true
      end

      it "returns false if no field has enhanced_confidence >= 0.7" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.6 },
          category: { enhanced_confidence: 0.65 }
        }
        expect(operation.send(:validate_high_confidence, field_conf)).to be false
      end

      it "returns false if field_confidence is empty" do
        expect(operation.send(:validate_high_confidence, {})).to be false
      end
    end

    describe "#should_suggest_retry?" do
      it "returns true if no field has enhanced_confidence >= 0.6" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.5 },
          category: { enhanced_confidence: 0.55 }
        }
        expect(operation.send(:should_suggest_retry?, field_conf)).to be true
      end

      it "returns false if any field has enhanced_confidence >= 0.6" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.6 },
          category: { enhanced_confidence: 0.55 }
        }
        expect(operation.send(:should_suggest_retry?, field_conf)).to be false
      end
    end

    describe "#should_recommend_manual?" do
      it "returns true if all fields have enhanced_confidence < 0.4" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.3 },
          category: { enhanced_confidence: 0.35 }
        }
        expect(operation.send(:should_recommend_manual?, field_conf)).to be true
      end

      it "returns false if any field has enhanced_confidence >= 0.4" do
        field_conf = {
          total_amount: { enhanced_confidence: 0.4 },
          category: { enhanced_confidence: 0.35 }
        }
        expect(operation.send(:should_recommend_manual?, field_conf)).to be false
      end
    end

    describe "#generate_recommendations" do
      it "generates correct recommendations for high confidence and complete data" do
        field_conf = { total_amount: { enhanced_confidence: 0.9 }, category: { enhanced_confidence: 0.8 } }
        overall_conf = 0.85
        flags = { reasonable_amount: true, valid_category: true, complete_data: true, high_confidence_extraction: true, suggest_retry: false, recommend_manual_entry: false, ai_processing_successful: true }
        result = operation.send(:generate_recommendations, field_confidence: field_conf, overall_confidence: overall_conf, validation_flags: flags)
        expect(result).to be_success
        expect(result.value!).to contain_exactly("AI extraction successful", "Data looks accurate, safe to proceed")
      end

      it "suggests retry for low overall confidence" do
        field_conf = { total_amount: { enhanced_confidence: 0.3 } }
        overall_conf = 0.3
        flags = { reasonable_amount: true, valid_category: false, complete_data: false, high_confidence_extraction: false, suggest_retry: true, recommend_manual_entry: false, ai_processing_successful: true }
        result = operation.send(:generate_recommendations, field_confidence: field_conf, overall_confidence: overall_conf, validation_flags: flags)
        expect(result).to be_success
        expect(result.value!).to include("Consider retaking the photo", "Verify category suggestion", "Consider manual verification of all fields")
      end

      it "recommends manual entry for very low confidence across all fields" do
        field_conf = { total_amount: { enhanced_confidence: 0.1 }, category: { enhanced_confidence: 0.1 } }
        overall_conf = 0.1
        flags = { reasonable_amount: false, valid_category: false, complete_data: false, high_confidence_extraction: false, suggest_retry: false, recommend_manual_entry: true, ai_processing_successful: true }
        result = operation.send(:generate_recommendations, field_confidence: field_conf, overall_confidence: overall_conf, validation_flags: flags)
        expect(result).to be_success
        expect(result.value!).to include("Manual entry recommended", "Review extracted amount", "Verify category suggestion", "Consider manual verification of all fields")
      end

      it "suggests review for medium overall confidence" do
        field_conf = { total_amount: { enhanced_confidence: 0.7 }, category: { enhanced_confidence: 0.6 } }
        overall_conf = 0.65
        flags = { reasonable_amount: true, valid_category: true, complete_data: true, high_confidence_extraction: true, suggest_retry: false, recommend_manual_entry: false, ai_processing_successful: true }
        result = operation.send(:generate_recommendations, field_confidence: field_conf, overall_confidence: overall_conf, validation_flags: flags)
        expect(result).to be_success
        expect(result.value!).to include("Review highlighted fields before proceeding")
      end
    end

    describe "#prepare_confidence_result" do
      let(:field_conf) { { total_amount: { enhanced_confidence: 0.8 } } }
      let(:overall_conf) { 0.8 }
      let(:reliability_assess) { { overall_level: :high, critical_fields_present: true } }
      let(:validation_flags) { { reasonable_amount: true, needs_review: false } }
      let(:recommendations) { ["All good"] }

      it "formats the final confidence result" do
        result = operation.send(:prepare_confidence_result,
          field_confidence: field_conf,
          overall_confidence: overall_conf,
          reliability_assessment: reliability_assess,
          validation_flags: validation_flags,
          recommendations: recommendations
        )

        expect(result).to be_success
        expect(result.value!).to include(
          field_confidence: field_conf,
          overall_confidence: overall_conf,
          reliability_assessment: reliability_assess,
          validation_flags: validation_flags,
          recommendations: recommendations,
          confidence_metadata: {
            total_fields_analyzed: 1,
            high_confidence_fields: 1,
            needs_review: false
          }
        )
      end

      it "sets needs_review in confidence_metadata based on overall_confidence" do
        low_overall_conf = 0.5
        result = operation.send(:prepare_confidence_result,
          field_confidence: field_conf,
          overall_confidence: low_overall_conf,
          reliability_assessment: reliability_assess,
          validation_flags: validation_flags,
          recommendations: recommendations
        )
        expect(result.value![:confidence_metadata][:needs_review]).to be true
      end
    end
  end
end
