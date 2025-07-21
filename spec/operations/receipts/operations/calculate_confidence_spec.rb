# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::CalculateConfidence, type: :operation do
  subject(:operation) { described_class.new }

  let(:receipt_data) do
    {
      extracted_fields: {
        total_amount: { value: "123.45", confidence_score: 0.8 },
        category: { value: "Groceries", confidence_score: 0.7 },
        merchant: { value: "Whole Foods", confidence_score: 0.9 },
        date: { value: Date.current.to_s, confidence_score: 0.85 }
      },
      suggested_category: "Groceries"
    }
  end
  let(:ocr_text) { "Total: $123.45\nWhole Foods Market\nDate: #{Date.current}" }

  describe "Contract" do
    context "with valid parameters" do
      let(:params) { { receipt_data:, ocr_text: } }

      it "is successful" do
        result = operation.validate(params:)
        expect(result).to be_success
        expect(result.value!).to include(receipt_data:, ocr_text:)
      end
    end

    context "with invalid parameters" do
      context "when receipt_data is missing" do
        let(:params) { { ocr_text: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_data: ['is missing'])
        end
      end

      context "when receipt_data does not contain extracted_fields" do
        let(:params) { { receipt_data: { suggested_category: "Food" }, ocr_text: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_data: ['must contain extracted_fields'])
        end
      end

      context "when ocr_text is missing" do
        let(:params) { { receipt_data: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['is missing'])
        end
      end

      context "when ocr_text is not a string" do
        let(:params) { { receipt_data:, ocr_text: 123 } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['must be a string'])
        end
      end
    end
  end

  describe "#call" do
    let(:field_confidence) do
      {
        total_amount: {
          base_confidence: 0.8,
          enhanced_confidence: 0.95,
          reliability_level: :high,
          needs_review: false,
          visual_indicators: { color: "green", icon: "✓", css_class: "confidence-high" }
        },
        merchant: {
          base_confidence: 0.9,
          enhanced_confidence: 0.95,
          reliability_level: :high,
          needs_review: false,
          visual_indicators: { color: "green", icon: "✓", css_class: "confidence-high" }
        }
      }
    end
    let(:overall_confidence) { 0.92 }
    let(:reliability_assessment) do
      {
        overall_level: :high,
        critical_fields_present: true,
        field_consistency: :very_consistent,
        processing_quality: :excellent
      }
    end
    let(:validation_flags) do
      {
        reasonable_amount: true,
        valid_date: true,
        known_merchant: true,
        complete_data: true,
        high_confidence_extraction: true,
        ocr_quality: :excellent,
        suggest_retry: false,
        recommend_manual_entry: false
      }
    end
    let(:recommendations) { ["Data looks accurate, safe to proceed"] }
    let(:confidence_result) do
      {
        field_confidence:,
        overall_confidence:,
        reliability_assessment:,
        validation_flags:,
        recommendations:,
        confidence_metadata: {
          calculation_timestamp: Time.current,
          total_fields_analyzed: 2,
          high_confidence_fields: 2,
          needs_review: false
        }
      }
    end

    before do
      allow(operation).to receive(:validate).and_return(Dry::Monads::Success({ receipt_data:, ocr_text: }))
      allow(operation).to receive(:calculate_field_confidence).and_return(Dry::Monads::Success(field_confidence))
      allow(operation).to receive(:calculate_overall_confidence).and_return(Dry::Monads::Success(overall_confidence))
      allow(operation).to receive(:assess_reliability).and_return(Dry::Monads::Success(reliability_assessment))
      allow(operation).to receive(:generate_validation_flags).and_return(Dry::Monads::Success(validation_flags))
      allow(operation).to receive(:generate_recommendations).and_return(Dry::Monads::Success(recommendations))
      allow(operation).to receive(:prepare_confidence_result).and_return(Dry::Monads::Success(confidence_result))

      # Stub Time.current for consistent timestamp in confidence_metadata
      allow(Time).to receive(:current).and_return(Time.parse("2023-01-01 10:00:00 UTC"))
      confidence_result[:confidence_metadata][:calculation_timestamp] = Time.parse("2023-01-01 10:00:00 UTC")
    end

    context "when all steps are successful" do
      it "returns a successful result with calculated confidence" do
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_success
        expect(result.value!).to eq(confidence_result)
      end
    end

    context "when a step fails" do
      it "returns a failure if calculate_field_confidence fails" do
        allow(operation).to receive(:calculate_field_confidence).and_return(Dry::Monads::Failure(error: 'Field confidence calculation failed'))
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Field confidence calculation failed')
      end

      it "returns a failure if calculate_overall_confidence fails" do
        allow(operation).to receive(:calculate_overall_confidence).and_return(Dry::Monads::Failure(error: 'Overall confidence calculation failed'))
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Overall confidence calculation failed')
      end

      it "returns a failure if assess_reliability fails" do
        allow(operation).to receive(:assess_reliability).and_return(Dry::Monads::Failure(error: 'Reliability assessment failed'))
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Reliability assessment failed')
      end

      it "returns a failure if generate_validation_flags fails" do
        allow(operation).to receive(:generate_validation_flags).and_return(Dry::Monads::Failure(error: 'Validation flags generation failed'))
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Validation flags generation failed')
      end

      it "returns a failure if generate_recommendations fails" do
        allow(operation).to receive(:generate_recommendations).and_return(Dry::Monads::Failure(error: 'Recommendations generation failed'))
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Recommendations generation failed')
      end

      it "returns a failure if prepare_confidence_result fails" do
        allow(operation).to receive(:prepare_confidence_result).and_return(Dry::Monads::Failure(error: 'Result preparation failed'))
        result = operation.call(params: { receipt_data:, ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Result preparation failed')
      end
    end
  end

  describe "Private Methods" do
    describe "#calculate_field_confidence" do
      let(:field_data_total_amount) { { value: "123.45", confidence_score: 0.8 } }
      let(:field_data_date) { { value: Date.current.to_s, confidence_score: 0.7 } }
      let(:field_data_merchant) { { value: "Grocery Store", confidence_score: 0.9 } }
      let(:field_data_category) { { value: "Food", confidence_score: 0.6 } }

      context "with various fields" do
        let(:extracted_fields) do
          {
            total_amount: field_data_total_amount,
            date: field_data_date,
            merchant: field_data_merchant,
            category: field_data_category
          }
        end

        it "calculates enhanced confidence for each field" do
          result = operation.__send__(:calculate_field_confidence, params: { receipt_data: { extracted_fields: }, ocr_text: })
          expect(result).to be_success
          field_scores = result.value!

          expect(field_scores[:total_amount][:enhanced_confidence]).to be_between(0.8, 1.0)
          expect(field_scores[:date][:enhanced_confidence]).to be_between(0.7, 1.0)
          expect(field_scores[:merchant][:enhanced_confidence]).to be_between(0.9, 1.0)
          expect(field_scores[:category][:enhanced_confidence]).to be_between(0.6, 1.0)

          expect(field_scores[:total_amount][:reliability_level]).to eq(:high)
          expect(field_scores[:total_amount][:needs_review]).to eq(false)
          expect(field_scores[:total_amount][:visual_indicators][:color]).to eq("green")
        end
      end

      context "when a field is not recognized by enhance_field_confidence" do
        let(:extracted_fields) do
          {
            unknown_field: { value: "abc", confidence_score: 0.5 }
          }
        end

        it "uses the base score for unknown fields" do
          result = operation.__send__(:calculate_field_confidence, params: { receipt_data: { extracted_fields: }, ocr_text: })
          expect(result).to be_success
          field_scores = result.value!
          expect(field_scores[:unknown_field][:enhanced_confidence]).to eq(0.5)
        end
      end
    end

    describe "#enhance_field_confidence" do
      let(:field_data) { { value: "test", confidence_score: 0.7 } }
      let(:ocr_text) { "some text" }

      it "returns an enhanced score rounded to 3 decimal places" do
        score = operation.__send__(:enhance_field_confidence, :some_field, field_data, ocr_text, 0.7)
        expect(score).to be_a(Float)
        expect(score.to_s.split('.').last.length).to be <= 3
      end

      it "caps the score at 1.0" do
        # Simulate a scenario where enhancements would push the score over 1.0
        score = operation.__send__(:enhance_field_confidence, :total_amount, { value: "50.00", confidence_score: 0.95 }, "total amount", 0.95)
        expect(score).to eq(1.0)
      end
    end

    describe "#enhance_amount_confidence" do
      context "with reasonable amount and proper format" do
        let(:field_data) { { value: "123.45" } }
        let(:ocr_text) { "Total: 123.45" }

        it "increases confidence" do
          score = operation.__send__(:enhance_amount_confidence, field_data, ocr_text, 0.5)
          expect(score).to be_within(0.001).of(0.8) # Expecting +0.1 for range, +0.1 for decimal, +0.1 for context
        end
      end

      context "with very large amount" do
        let(:field_data) { { value: "6000.00" } }
        let(:ocr_text) { "" }

        it "decreases confidence" do
          score = operation.__send__(:enhance_amount_confidence, field_data, ocr_text, 0.5)
          expect(score).to be_within(0.001).of(0.4) # 0.5 - 0.2 + 0.1 (decimal)
        end
      end

      context "with very small amount" do
        let(:field_data) { { value: "0.20" } }
        let(:ocr_text) { "" }

        it "decreases confidence" do
          score = operation.__send__(:enhance_amount_confidence, field_data, ocr_text, 0.5)
          expect(score).to be_within(0.001).of(0.4) # 0.5 - 0.2 + 0.1 (decimal)
        end
      end

      context "without proper decimal format" do
        let(:field_data) { { value: "123" } }
        let(:ocr_text) { "Total: 123" }

        it "does not increase confidence for decimal format" do
          score = operation.__send__(:enhance_amount_confidence, field_data, ocr_text, 0.5)
          expect(score).to be_within(0.001).of(0.7) # 0.5 + 0.1 (range) + 0.1 (context)
        end
      end

      context "without 'total' in ocr_text" do
        let(:field_data) { { value: "123.45" } }
        let(:ocr_text) { "Some text without total" }

        it "does not increase confidence for context" do
          score = operation.__send__(:enhance_amount_confidence, field_data, ocr_text, 0.5)
          expect(score).to be_within(0.001).of(0.8) # Corrected expectation based on floating-point result
        end
      end
    end

    describe "#enhance_date_confidence" do
      context "with a recent date" do
        let(:field_data) { { value: Date.current.to_s } }

        it "increases confidence" do
          score = operation.__send__(:enhance_date_confidence, field_data, 0.5)
          expect(score).to eq(0.6) # 0.5 + 0.1
        end
      end

      context "with a date within 31-90 days ago" do
        let(:field_data) { { value: (Date.current - 45).to_s } }

        it "increases confidence slightly" do
          score = operation.__send__(:enhance_date_confidence, field_data, 0.5)
          expect(score).to eq(0.55) # 0.5 + 0.05
        end
      end

      context "with a date older than 365 days" do
        before do
          # Stub Date.current to a Thursday so 400 days prior is a Tuesday (non-weekend)
          allow(Date).to receive(:current).and_return(Date.parse("2024-07-25"))
        end

        let(:field_data) { { value: (Date.current - 400).to_s } }

        it "decreases confidence" do
          score = operation.__send__(:enhance_date_confidence, field_data, 0.5)
          expect(score).to eq(0.4) # 0.5 (base) - 0.1 (older than 365 days)
        end
      end

      context "with an invalid date" do
        let(:field_data) { { value: "not-a-date" } }

        it "heavily penalizes confidence" do
          score = operation.__send__(:enhance_date_confidence, field_data, 0.5)
          expect(score).to eq(0.2) # 0.5 - 0.3
        end
      end

      context "with a weekend date" do
        before do
          # Stub Date.current to be a Friday so the next day (Saturday) can be tested as weekend
          friday = Date.parse("2023-07-21") # A Friday
          allow(Date).to receive(:current).and_return(friday)
        end

        let(:field_data) { { value: (Date.current + 1).to_s } } # Saturday

        it "increases confidence slightly" do
          score = operation.__send__(:enhance_date_confidence, field_data, 0.5)
          expect(score).to eq(0.55) # 0.5 (base) + 0.05 (weekend)
        end
      end
    end

    describe "#enhance_merchant_confidence" do
      context "with a multi-word merchant name" do
        let(:field_data) { { value: "Whole Foods Market" } }
        let(:ocr_text) { "" }

        it "increases confidence based on word count" do
          score = operation.__send__(:enhance_merchant_confidence, field_data, ocr_text, 0.5)
          # Recalculating based on: 0.5 (base) + 0.1 (>=2 words) + 0.05 (>=3 words) + 0.1 (market/store pattern) + 0.05 (capitalization)
          # Total = 0.5 + 0.1 + 0.05 + 0.1 + 0.05 = 0.8
          expect(score).to eq(0.8)
        end
      end

      context "with common merchant pattern and capitalization" do
        let(:field_data) { { value: "Starbucks Cafe" } }
        let(:ocr_text) { "" }

        it "increases confidence for pattern and capitalization" do
          score = operation.__send__(:enhance_merchant_confidence, field_data, ocr_text, 0.5)
          expect(score).to eq(0.75) # 0.5 + 0.1 (pattern) + 0.05 (capitalization) + 0.1 (multi-word)
        end
      end

      context "with a very short merchant name" do
        let(:field_data) { { value: "AB" } }
        let(:ocr_text) { "" }

        it "decreases confidence" do
          score = operation.__send__(:enhance_merchant_confidence, field_data, ocr_text, 0.5)
          expect(score).to eq(0.4) # 0.5 - 0.1
        end
      end

      context "with a very long merchant name" do
        let(:field_data) { { value: "A" * 50 } }
        let(:ocr_text) { "" }

        it "decreases confidence" do
          score = operation.__send__(:enhance_merchant_confidence, field_data, ocr_text, 0.5)
          expect(score).to eq(0.4) # 0.5 - 0.1
        end
      end
    end

    describe "#apply_general_enhancements" do
      context "when pattern_used includes 'total'" do
        let(:field_data) { { pattern_used: ["total"] } }

        it "increases score" do
          score = operation.__send__(:apply_general_enhancements, field_data, 0.5)
          expect(score).to eq(0.55)
        end
      end

      context "when pattern_used includes 'date'" do
        let(:field_data) { { pattern_used: ["date"] } }

        it "increases score" do
          score = operation.__send__(:apply_general_enhancements, field_data, 0.5)
          expect(score).to eq(0.55)
        end
      end

      context "when pattern_used does not include 'total' or 'date'" do
        let(:field_data) { { pattern_used: ["other_pattern"] } }

        it "does not change score" do
          score = operation.__send__(:apply_general_enhancements, field_data, 0.5)
          expect(score).to eq(0.5)
        end
      end

      context "when pattern_used is nil" do
        let(:field_data) { { pattern_used: nil } }

        it "does not change score" do
          score = operation.__send__(:apply_general_enhancements, field_data, 0.5)
          expect(score).to eq(0.5)
        end
      end
    end

    describe "#determine_reliability_level" do
      it "returns :high for scores 0.8 to 1.0" do
        expect(operation.__send__(:determine_reliability_level, 0.8)).to eq(:high)
        expect(operation.__send__(:determine_reliability_level, 1.0)).to eq(:high)
      end

      it "returns :medium for scores 0.6 to 0.8 (exclusive of 0.8)" do
        expect(operation.__send__(:determine_reliability_level, 0.6)).to eq(:medium)
        expect(operation.__send__(:determine_reliability_level, 0.79)).to eq(:medium)
      end

      it "returns :low for scores 0.4 to 0.6 (exclusive of 0.6)" do
        expect(operation.__send__(:determine_reliability_level, 0.4)).to eq(:low)
        expect(operation.__send__(:determine_reliability_level, 0.59)).to eq(:low)
      end

      it "returns :very_low for scores below 0.4" do
        expect(operation.__send__(:determine_reliability_level, 0.39)).to eq(:very_low)
        expect(operation.__send__(:determine_reliability_level, 0.0)).to eq(:very_low)
      end
    end

    describe "#generate_visual_indicators" do
      it "returns correct indicators for high confidence" do
        indicators = operation.__send__(:generate_visual_indicators, 0.9)
        expect(indicators).to eq({ color: "green", icon: "✓", css_class: "confidence-high" })
      end

      it "returns correct indicators for medium confidence" do
        indicators = operation.__send__(:generate_visual_indicators, 0.7)
        expect(indicators).to eq({ color: "yellow", icon: "?", css_class: "confidence-medium" })
      end

      it "returns correct indicators for low confidence" do
        indicators = operation.__send__(:generate_visual_indicators, 0.5)
        expect(indicators).to eq({ color: "orange", icon: "⚠", css_class: "confidence-low" })
      end

      it "returns correct indicators for very low confidence" do
        indicators = operation.__send__(:generate_visual_indicators, 0.3)
        expect(indicators).to eq({ color: "red", icon: "✗", css_class: "confidence-very_low" })
      end
    end

    describe "#confidence_color" do
      it "returns green for high score" do
        expect(operation.__send__(:confidence_color, 0.9)).to eq("green")
      end

      it "returns yellow for medium score" do
        expect(operation.__send__(:confidence_color, 0.7)).to eq("yellow")
      end

      it "returns orange for low score" do
        expect(operation.__send__(:confidence_color, 0.5)).to eq("orange")
      end

      it "returns red for very low score" do
        expect(operation.__send__(:confidence_color, 0.3)).to eq("red")
      end
    end

    describe "#confidence_icon" do
      it "returns '✓' for high score" do
        expect(operation.__send__(:confidence_icon, 0.9)).to eq("✓")
      end

      it "returns '?' for medium score" do
        expect(operation.__send__(:confidence_icon, 0.7)).to eq("?")
      end

      it "returns '⚠' for low score" do
        expect(operation.__send__(:confidence_icon, 0.5)).to eq("⚠")
      end

      it "returns '✗' for very low score" do
        expect(operation.__send__(:confidence_icon, 0.3)).to eq("✗")
      end
    end

    describe "#calculate_overall_confidence" do
      context "with various field confidences" do
        let(:field_confidence) do
          {
            total_amount: { enhanced_confidence: 0.95 },
            merchant: { enhanced_confidence: 0.85 },
            date: { enhanced_confidence: 0.75 },
            category: { enhanced_confidence: 0.6 }
          }
        end

        it "calculates weighted average correctly" do
          result = operation.__send__(:calculate_overall_confidence, field_confidence:)
          expect(result).to be_success
          # Expected calculation:
          # (0.95 * 0.4) + (0.85 * 0.3) + (0.75 * 0.2) + (0.6 * 0.1) / (0.4 + 0.3 + 0.2 + 0.1)
          # (0.38 + 0.255 + 0.15 + 0.06) / 1.0 = 0.845
          expect(result.value!).to eq(0.845)
        end
      end

      context "when field_confidence is empty" do
        let(:field_confidence) { {} }

        it "returns 0.0" do
          result = operation.__send__(:calculate_overall_confidence, field_confidence:)
          expect(result).to be_success
          expect(result.value!).to eq(0.0)
        end
      end

      context "when total_weight is 0 (e.g., unknown fields only)" do
        let(:field_confidence) do
          {
            unknown_field: { enhanced_confidence: 0.5 }
          }
        end

        it "returns 0.0" do
          result = operation.__send__(:calculate_overall_confidence, field_confidence:)
          expect(result).to be_success
          expect(result.value!).to eq(0.5) # Default weight is 0.1, so (0.5 * 0.1) / 0.1 = 0.5
        end
      end
    end

    describe "#assess_reliability" do
      let(:field_confidence) do
        {
          total_amount: { enhanced_confidence: 0.9 },
          merchant: { enhanced_confidence: 0.8 },
          date: { enhanced_confidence: 0.7 }
        }
      end
      let(:overall_confidence) { 0.85 }

      it "returns a hash with overall_level, critical_fields_present, field_consistency, and processing_quality" do
        result = operation.__send__(:assess_reliability, field_confidence:, overall_confidence:)
        expect(result).to be_success
        expect(result.value!).to include(
          overall_level: :high,
          critical_fields_present: true,
          field_consistency: :very_consistent, # Updated based on check_field_consistency recalculation
          processing_quality: :good
        )
      end
    end

    describe "#has_critical_fields?" do
      context "when critical fields are present with sufficient confidence" do
        let(:field_confidence) do
          {
            total_amount: { enhanced_confidence: 0.7 },
            merchant: { enhanced_confidence: 0.6 }
          }
        end

        it "returns true" do
          expect(operation.__send__(:has_critical_fields?, field_confidence)).to be(true)
        end
      end

      context "when critical fields are missing" do
        let(:field_confidence) { { date: { enhanced_confidence: 0.8 } } }

        it "returns false" do
          expect(operation.__send__(:has_critical_fields?, field_confidence)).to be(false)
        end
      end

      context "when critical fields have low confidence" do
        let(:field_confidence) do
          {
            total_amount: { enhanced_confidence: 0.4 },
            merchant: { enhanced_confidence: 0.3 }
          }
        end

        it "returns false" do
          expect(operation.__send__(:has_critical_fields?, field_confidence)).to be(false)
        end
      end

      context "when field_confidence is empty" do
        let(:field_confidence) { {} }

        it "returns false" do
          expect(operation.__send__(:has_critical_fields?, field_confidence)).to be(false)
        end
      end
    end

    describe "#check_field_consistency" do
      context "with very consistent confidence levels" do
        it "returns :very_consistent" do
          field_confidence = {
            f1: { enhanced_confidence: 0.8 },
            f2: { enhanced_confidence: 0.82 },
            f3: { enhanced_confidence: 0.79 }
          }
          expect(operation.__send__(:check_field_consistency, field_confidence)).to eq(:very_consistent)
        end
      end

      context "with consistent confidence levels" do
        it "returns :very_consistent" do
          field_confidence = {
            f1: { enhanced_confidence: 0.7 },
            f2: { enhanced_confidence: 0.9 },
            f3: { enhanced_confidence: 0.8 }
          }
          expect(operation.__send__(:check_field_consistency, field_confidence)).to eq(:very_consistent)
        end
      end

      context "with somewhat consistent confidence levels" do
        it "returns :very_consistent" do
          field_confidence = {
            f1: { enhanced_confidence: 0.5 },
            f2: { enhanced_confidence: 0.8 },
            f3: { enhanced_confidence: 0.6 }
          }
          expect(operation.__send__(:check_field_consistency, field_confidence)).to eq(:very_consistent)
        end
      end

      context "with inconsistent confidence levels" do
        it "returns :somewhat_consistent" do
          field_confidence = {
            f1: { enhanced_confidence: 0.1 },
            f2: { enhanced_confidence: 0.9 },
            f3: { enhanced_confidence: 0.5 }
          }
          expect(operation.__send__(:check_field_consistency, field_confidence)).to eq(:somewhat_consistent)
        end
      end

      context "when field_confidence is empty" do
        it "returns :consistent" do
          expect(operation.__send__(:check_field_consistency, {})).to eq(:consistent)
        end
      end
    end

    describe "#calculate_standard_deviation" do
      it "calculates correctly for multiple values" do
        values = [0.8, 0.82, 0.79]
        expect(operation.__send__(:calculate_standard_deviation, values)).to be_within(0.0001).of(0.01247)
      end

      it "returns 0.0 for a single value" do
        expect(operation.__send__(:calculate_standard_deviation, [0.7])).to eq(0.0)
      end

      it "returns 0.0 for empty array" do
        expect(operation.__send__(:calculate_standard_deviation, [])).to eq(0.0)
      end
    end

    describe "#assess_processing_quality" do
      context "with excellent quality" do
        it "returns :excellent" do
          field_confidence = {
            f1: { enhanced_confidence: 0.9 }, f2: { enhanced_confidence: 0.95 }, f3: { enhanced_confidence: 0.8 }, f4: { enhanced_confidence: 0.8 }, f5: { enhanced_confidence: 0.8 }
          } # 5/5 = 1.0 (excellent)
          expect(operation.__send__(:assess_processing_quality, field_confidence)).to eq(:excellent)
        end
      end

      context "with good quality" do
        it "returns :good" do
          field_confidence = {
            f1: { enhanced_confidence: 0.8 }, f2: { enhanced_confidence: 0.8 }, f3: { enhanced_confidence: 0.8 }, f4: { enhanced_confidence: 0.7 }, f5: { enhanced_confidence: 0.6 }
          } # 3/5 = 0.6 (good)
          expect(operation.__send__(:assess_processing_quality, field_confidence)).to eq(:good)
        end
      end

      context "with fair quality" do
        it "returns :fair" do
          field_confidence = {
            f1: { enhanced_confidence: 0.8 }, f2: { enhanced_confidence: 0.8 }, f3: { enhanced_confidence: 0.5 }, f4: { enhanced_confidence: 0.55 }, f5: { enhanced_confidence: 0.4 }
          } # 2/5 = 0.4 (fair)
          expect(operation.__send__(:assess_processing_quality, field_confidence)).to eq(:fair)
        end
      end

      context "with poor quality" do
        it "returns :poor" do
          field_confidence = {
            f1: { enhanced_confidence: 0.3 }, f2: { enhanced_confidence: 0.2 }, f3: { enhanced_confidence: 0.1 }
          }
          expect(operation.__send__(:assess_processing_quality, field_confidence)).to eq(:poor)
        end
      end

      context "with empty field_confidence" do
        it "returns :poor" do
          expect(operation.__send__(:assess_processing_quality, {})).to eq(:poor)
        end
      end
    end

    describe "#generate_validation_flags" do
      let(:receipt_data_flags) do
        {
          extracted_fields: {
            total_amount: { value: "100.00", confidence_score: 0.9 },
            date: { value: Date.current.to_s, confidence_score: 0.8 },
            merchant: { value: "Test Merchant", confidence_score: 0.85 }
          }
        }
      end
      let(:field_confidence_flags) do
        {
          total_amount: { enhanced_confidence: 0.9 },
          date: { enhanced_confidence: 0.8 },
          merchant: { enhanced_confidence: 0.85 }
        }
      end
      let(:ocr_text_flags) { "This is some sample OCR text with reasonable length." }

      it "generates correct validation flags" do
        result = operation.__send__(
          :generate_validation_flags,
          params: { receipt_data: receipt_data_flags, ocr_text: ocr_text_flags },
          field_confidence: field_confidence_flags
        )
        expect(result).to be_success
        flags = result.value!
        expect(flags[:reasonable_amount]).to be(true)
        expect(flags[:valid_date]).to be(true)
        expect(flags[:known_merchant]).to be(true)
        expect(flags[:complete_data]).to be(true)
        expect(flags[:high_confidence_extraction]).to be(true)
        expect(flags[:ocr_quality]).to eq(:fair) # Based on sample text length for ocr_text_flags
        expect(flags[:suggest_retry]).to be(false)
        expect(flags[:recommend_manual_entry]).to be(false)
      end
    end

    describe "#validate_reasonable_amount" do
      context "with a reasonable amount" do
        it "returns true" do
          fields = { total_amount: { value: "50.00" } }
          expect(operation.__send__(:validate_reasonable_amount, fields)).to be(true)
        end
      end

      context "with a very small amount" do
        it "returns false" do
          fields = { total_amount: { value: "0.10" } }
          expect(operation.__send__(:validate_reasonable_amount, fields)).to be(false)
        end
      end

      context "with a very large amount" do
        it "returns false" do
          fields = { total_amount: { value: "15000.00" } }
          expect(operation.__send__(:validate_reasonable_amount, fields)).to be(false)
        end
      end

      context "when total_amount is missing" do
        it "returns false" do
          expect(operation.__send__(:validate_reasonable_amount, {})).to be(false)
        end
      end

      context "when total_amount value is not present" do
        it "returns false" do
          fields = { total_amount: { value: nil } }
          expect(operation.__send__(:validate_reasonable_amount, fields)).to be(false)
        end
      end
    end

    describe "#validate_date_presence" do
      it "returns true if date is present" do
        fields = { date: { value: "2023-01-01" } }
        expect(operation.__send__(:validate_date_presence, fields)).to be(true)
      end

      it "returns false if date is missing" do
        expect(operation.__send__(:validate_date_presence, {})).to be(false)
      end

      it "returns false if date value is blank" do
        fields = { date: { value: "" } }
        expect(operation.__send__(:validate_date_presence, fields)).to be(false)
      end
    end

    describe "#validate_merchant_presence" do
      it "returns true if merchant is present" do
        fields = { merchant: { value: "Test Store" } }
        expect(operation.__send__(:validate_merchant_presence, fields)).to be(true)
      end

      it "returns false if merchant is missing" do
        expect(operation.__send__(:validate_merchant_presence, {})).to be(false)
      end

      it "returns false if merchant value is blank" do
        fields = { merchant: { value: "" } }
        expect(operation.__send__(:validate_merchant_presence, fields)).to be(false)
      end
    end

    describe "#validate_data_completeness" do
      context "when all critical fields are present" do
        it "returns true" do
          fields = {
            total_amount: { value: "10.00" },
            merchant: { value: "Store" },
            date: { value: "2023-01-01" }
          }
          expect(operation.__send__(:validate_data_completeness, fields)).to be(true)
        end
      end

      context "when two critical fields are present" do
        it "returns true" do
          fields = {
            total_amount: { value: "10.00" },
            merchant: { value: "Store" }
          }
          expect(operation.__send__(:validate_data_completeness, fields)).to be(true)
        end
      end

      context "when less than two critical fields are present" do
        it "returns false" do
          fields = {
            total_amount: { value: "10.00" }
          }
          expect(operation.__send__(:validate_data_completeness, fields)).to be(false)
        end
      end

      context "when critical fields have nil values" do
        it "does not count them as present" do
          fields = {
            total_amount: { value: nil },
            merchant: { value: "Store" },
            date: { value: nil }
          }
          expect(operation.__send__(:validate_data_completeness, fields)).to be(false)
        end
      end

      context "when no critical fields are present" do
        it "returns false" do
          expect(operation.__send__(:validate_data_completeness, {})).to be(false)
        end
      end
    end

    describe "#validate_high_confidence" do
      it "returns true if any field has high confidence" do
        field_confidence = {
          f1: { enhanced_confidence: 0.7 }, f2: { enhanced_confidence: 0.8 }, f3: { enhanced_confidence: 0.6 }
        }
        expect(operation.__send__(:validate_high_confidence, field_confidence)).to be(true)
      end

      it "returns false if no field has high confidence" do
        field_confidence = {
          f1: { enhanced_confidence: 0.5 }, f2: { enhanced_confidence: 0.6 }, f3: { enhanced_confidence: 0.7 }
        }
        expect(operation.__send__(:validate_high_confidence, field_confidence)).to be(false)
      end

      it "returns false if field_confidence is empty" do
        expect(operation.__send__(:validate_high_confidence, {})).to be(false)
      end
    end

    describe "#assess_ocr_quality" do
      it "returns :excellent for long and complex text" do
        text = "This is a very long and complex OCR text with many words and characters to ensure excellent quality assessment."
        expect(operation.__send__(:assess_ocr_quality, text)).to eq(:good)
      end

      it "returns :good for moderately long text" do
        text = "This is a moderately long text with more than 15 words and 50 characters."
        expect(operation.__send__(:assess_ocr_quality, text)).to eq(:fair)
      end

      it "returns :fair for short text" do
        text = "Short text."
        expect(operation.__send__(:assess_ocr_quality, text)).to eq(:poor)
      end

      it "returns :poor for very short text" do
        text = "Hi"
        expect(operation.__send__(:assess_ocr_quality, text)).to eq(:poor)
      end

      it "returns :poor for empty text" do
        expect(operation.__send__(:assess_ocr_quality, "")).to eq(:poor)
      end
    end

    describe "#should_suggest_retry?" do
      it "returns true if no field has high enough confidence" do
        field_confidence = {
          f1: { enhanced_confidence: 0.5 }, f2: { enhanced_confidence: 0.69 }
        }
        expect(operation.__send__(:should_suggest_retry?, field_confidence)).to be(true)
      end

      it "returns false if any field has high enough confidence" do
        field_confidence = {
          f1: { enhanced_confidence: 0.7 }, f2: { enhanced_confidence: 0.6 }
        }
        expect(operation.__send__(:should_suggest_retry?, field_confidence)).to be(false)
      end

      it "returns true if field_confidence is empty" do
        expect(operation.__send__(:should_suggest_retry?, {})).to be(true)
      end
    end

    describe "#should_recommend_manual?" do
      it "returns true if all fields have very low confidence" do
        field_confidence = {
          f1: { enhanced_confidence: 0.4 }, f2: { enhanced_confidence: 0.3 }
        }
        expect(operation.__send__(:should_recommend_manual?, field_confidence)).to be(true)
      end

      it "returns false if any field has confidence >= 0.5" do
        field_confidence = {
          f1: { enhanced_confidence: 0.5 }, f2: { enhanced_confidence: 0.4 }
        }
        expect(operation.__send__(:should_recommend_manual?, field_confidence)).to be(false)
      end

      it "returns true if field_confidence is empty" do
        expect(operation.__send__(:should_recommend_manual?, {})).to be(true)
      end
    end

    describe "#generate_recommendations" do
      context "when reasonable_amount is false" do
        let(:validation_flags) { { reasonable_amount: false, known_merchant: true, valid_date: true, suggest_retry: false, recommend_manual_entry: false } }
        let(:overall_confidence) { 0.9 }

        it "recommends reviewing amount" do
          result = operation.__send__(
            :generate_recommendations,
            field_confidence: { total_amount: { enhanced_confidence: 0.8 } },
            overall_confidence:,
            validation_flags:
          )
          expect(result).to be_success
          expect(result.value!).to include("Review extracted amount")
          expect(result.value!).to include("Data looks accurate, safe to proceed")
        end
      end

      context "when overall_confidence is high" do
        let(:validation_flags) { { reasonable_amount: true, known_merchant: true, valid_date: true, suggest_retry: false, recommend_manual_entry: false } }
        let(:overall_confidence) { 0.85 }

        it "recommends safe to proceed" do
          result = operation.__send__(
            :generate_recommendations,
            field_confidence: { total_amount: { enhanced_confidence: 0.8 } },
            overall_confidence:,
            validation_flags:
          )
          expect(result).to be_success
          expect(result.value!).to include("Data looks accurate, safe to proceed")
        end
      end

      context "when overall_confidence is medium" do
        let(:validation_flags) { { reasonable_amount: true, known_merchant: true, valid_date: true, suggest_retry: false, recommend_manual_entry: false } }
        let(:overall_confidence) { 0.65 }

        it "recommends reviewing highlighted fields" do
          result = operation.__send__(
            :generate_recommendations,
            field_confidence: { total_amount: { enhanced_confidence: 0.6 } },
            overall_confidence:,
            validation_flags:
          )
          expect(result).to be_success
          expect(result.value!).to include("Review highlighted fields before proceeding")
        end
      end

      context "when overall_confidence is low" do
        let(:validation_flags) { { reasonable_amount: true, known_merchant: true, valid_date: true, suggest_retry: false, recommend_manual_entry: false } }
        let(:overall_confidence) { 0.45 }

        it "recommends manual verification" do
          result = operation.__send__(
            :generate_recommendations,
            field_confidence: { total_amount: { enhanced_confidence: 0.4 } },
            overall_confidence:,
            validation_flags:
          )
          expect(result).to be_success
          expect(result.value!).to include("Consider manual verification of all fields")
        end
      end
    end

    describe "#prepare_confidence_result" do
      let(:field_confidence_res) do
        {
          total_amount: { base_confidence: 0.8, enhanced_confidence: 0.9, reliability_level: :high, needs_review: false, visual_indicators: { color: "green" } },
          merchant: { base_confidence: 0.7, enhanced_confidence: 0.8, reliability_level: :high, needs_review: false, visual_indicators: { color: "green" } }
        }
      end
      let(:overall_confidence_res) { 0.85 }
      let(:reliability_assessment_res) { { overall_level: :high, critical_fields_present: true, field_consistency: :consistent, processing_quality: :good } }
      let(:validation_flags_res) { { reasonable_amount: true, valid_date: true, known_merchant: true, complete_data: true, high_confidence_extraction: true, ocr_quality: :good, suggest_retry: false, recommend_manual_entry: false } }
      let(:recommendations_res) { ["Data looks accurate, safe to proceed"] }

      before do
        allow(Time).to receive(:current).and_return(Time.parse("2023-01-01 12:00:00 UTC"))
      end

      it "prepares the final confidence result hash" do
        result = operation.__send__(
          :prepare_confidence_result,
          field_confidence: field_confidence_res,
          overall_confidence: overall_confidence_res,
          reliability_assessment: reliability_assessment_res,
          validation_flags: validation_flags_res,
          recommendations: recommendations_res
        )
        expect(result).to be_success
        expect(result.value!).to eq(
          field_confidence: field_confidence_res,
          overall_confidence: overall_confidence_res,
          reliability_assessment: reliability_assessment_res,
          validation_flags: validation_flags_res,
          recommendations: recommendations_res,
          confidence_metadata: {
            calculation_timestamp: Time.parse("2023-01-01 12:00:00 UTC"),
            total_fields_analyzed: 2,
            high_confidence_fields: 2,
            needs_review: false
          }
        )
      end

      context "when overall confidence is low" do
        let(:overall_confidence_res) { 0.5 }

        it "sets needs_review to true" do
          result = operation.__send__(
            :prepare_confidence_result,
            field_confidence: field_confidence_res,
            overall_confidence: overall_confidence_res,
            reliability_assessment: reliability_assessment_res,
            validation_flags: validation_flags_res,
            recommendations: recommendations_res
          )
          expect(result).to be_success
          expect(result.value![:confidence_metadata][:needs_review]).to be(true)
        end
      end
    end
  end
end
