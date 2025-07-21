# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::ExtractReceiptData, type: :operation do
  subject(:operation) { described_class.new }

  let(:ocr_text) { "Total: $100.00\nDate: #{Date.current}\nMerchant: Whole Foods" }

  let(:extracted_fields) do
    {
      total_amount: { value: "100.00", pattern: /total[:\s]*\$?(\d+\.?\d*)/i, pattern_index: 0, position: 0.1, confidence_factors: { near_end: true, has_currency_nearby: true, surrounded_by_numbers: true } },
      date: { value: Date.current.to_s, pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/, pattern_index: 0, position: 0.5, confidence_factors: { near_beginning: true, has_currency_nearby: true, surrounded_by_numbers: true } },
      merchant: { value: "Whole Foods", pattern: /^([A-Z\s&'.-]+)(?:\s+#\d+)?\s*$/m, pattern_index: 0, position: 0.9, confidence_factors: { near_beginning: true, multi_word: true } }
    }
  end

  let(:validated_fields_fixture) do
    {
      total_amount: extracted_fields[:total_amount].merge(validated_value: 100.00, formatted_value: "100.00"),
      date: extracted_fields[:date].merge(validated_value: Date.current, formatted_value: Date.current.strftime("%Y-%m-%d")),
      merchant: extracted_fields[:merchant].merge(validated_value: "Whole Foods", formatted_value: "Whole Foods")
    }
  end

  let(:processed_fields_fixture) do
    {
      total_amount: { value: "100.00", confidence_score: 0.8, pattern_used: extracted_fields[:total_amount][:pattern].source, extraction_method: "pattern_total_amount" },
      date: { value: Date.current.strftime("%Y-%m-%d"), confidence_score: 0.7, pattern_used: extracted_fields[:date][:pattern].source, extraction_method: "pattern_date" },
      merchant: { value: "Whole Foods", confidence_score: 0.75, pattern_used: extracted_fields[:merchant][:pattern].source, extraction_method: "pattern_merchant" }
    }
  end

  let(:suggested_category_fixture) { "Family" }

  let(:final_result_fixture) do
    {
      extracted_fields: processed_fields_fixture,
      suggested_category: suggested_category_fixture,
      extraction_metadata: {
        total_fields_found: 3,
        has_essential_data: true,
        extraction_timestamp: Time.current,
        processing_method: "tesseract_pattern_matching"
      }
    }
  end

  before do
    allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
    allow(Time).to receive(:current).and_return(Time.parse("2023-01-01 10:00:00 UTC"))
    final_result_fixture[:extraction_metadata][:extraction_timestamp] = Time.parse("2023-01-01 10:00:00 UTC")
  end

  describe "Contract" do
    context "with valid parameters" do
      let(:params) { { ocr_text: } }

      it "is successful" do
        result = operation.validate(params:)
        expect(result).to be_success
        expect(result.value!).to include(ocr_text:)
      end
    end

    context "with invalid ocr_text" do
      context "when ocr_text is missing" do
        let(:params) { {} }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['is missing'])
        end
      end

      context "when ocr_text is blank" do
        let(:params) { { ocr_text: "" } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['cannot be blank'])
        end
      end

      context "when ocr_text is not a string" do
        let(:params) { { ocr_text: 123 } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['must be a string'])
        end
      end
    end
  end

  describe "#call" do
    before do
      allow(operation).to receive(:validate).and_return(Dry::Monads::Success({ ocr_text: }))
      allow(operation).to receive(:extract_all_fields).and_return(Dry::Monads::Success(extracted_fields))
      allow(operation).to receive(:validate_extracted_fields).and_return(Dry::Monads::Success(validated_fields_fixture))
      allow(operation).to receive(:process_field_values).and_return(Dry::Monads::Success(processed_fields_fixture))
      allow(operation).to receive(:suggest_category).and_return(Dry::Monads::Success(suggested_category_fixture))
      allow(operation).to receive(:prepare_extraction_result).and_return(Dry::Monads::Success(final_result_fixture))
    end

    context "when all steps are successful" do
      it "returns a successful result with extracted data" do
        result = operation.call(params: { ocr_text: })
        expect(result).to be_success
        expect(result.value!).to eq(final_result_fixture)
      end
    end

    context "when a step fails" do
      it "returns a failure if validate fails" do
        allow(operation).to receive(:validate).and_return(Dry::Monads::Failure(error: 'Validation failed'))
        result = operation.call(params: { ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Validation failed')
      end

      it "returns a failure if extract_all_fields fails" do
        allow(operation).to receive(:extract_all_fields).and_return(Dry::Monads::Failure(error: 'Extraction failed'))
        result = operation.call(params: { ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Extraction failed')
      end

      it "returns a failure if validate_extracted_fields fails" do
        allow(operation).to receive(:validate_extracted_fields).and_return(Dry::Monads::Failure(error: 'Field validation failed'))
        result = operation.call(params: { ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Field validation failed')
      end

      it "returns a failure if process_field_values fails" do
        allow(operation).to receive(:process_field_values).and_return(Dry::Monads::Failure(error: 'Field processing failed'))
        result = operation.call(params: { ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Field processing failed')
      end

      it "returns a failure if suggest_category fails" do
        allow(operation).to receive(:suggest_category).and_return(Dry::Monads::Failure(error: 'Category suggestion failed'))
        result = operation.call(params: { ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Category suggestion failed')
      end

      it "returns a failure if prepare_extraction_result fails" do
        allow(operation).to receive(:prepare_extraction_result).and_return(Dry::Monads::Failure(error: 'Result preparation failed'))
        result = operation.call(params: { ocr_text: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Result preparation failed')
      end
    end
  end

  describe "Private Methods" do
    describe "#extract_all_fields" do
      context "with a simple receipt text" do
        let(:simple_ocr_text) { "Total: $123.45\nDate: 01/01/2023\nStore: My Shop" }

        it "extracts all available fields" do
          result = operation.__send__(:extract_all_fields, params: { ocr_text: simple_ocr_text })
          expect(result).to be_success
          extracted = result.value!

          expect(extracted).to have_key(:total_amount)
          expect(extracted[:total_amount][:value]).to eq("123.45")
          expect(extracted[:total_amount][:score]).to be_present

          expect(extracted).to have_key(:date)
          expect(extracted[:date][:value]).to eq("01/01/2023")
          expect(extracted[:date][:score]).to be_present

          expect(extracted).to have_key(:merchant)
          expect(extracted[:merchant][:value]).to eq("My Shop")
          expect(extracted[:merchant][:score]).to be_present
        end
      end

      context "when no matches are found for a field" do
        let(:no_match_ocr_text) { "Just some random text without totals or dates." }

        it "does not include fields with no matches" do
          result = operation.__send__(:extract_all_fields, params: { ocr_text: no_match_ocr_text })
          expect(result).to be_success
          extracted = result.value!
          expect(extracted).to be_empty
        end
      end

      context "when multiple patterns match for a field" do
        let(:multiple_match_ocr_text) { "Total: $50.00\nAmount: $50.00\nSubtotal: $50.00" }

        it "selects the best match based on score" do
          # No need to mock calculate_match_score here, as select_best_match relies on its actual logic.
          # The patterns are designed to naturally produce the expected best match.
          result = operation.__send__(:extract_all_fields, params: { ocr_text: multiple_match_ocr_text })
          expect(result).to be_success
          extracted = result.value!
          expect(extracted[:total_amount][:value]).to eq("50.00")
          expect(extracted[:total_amount][:pattern_index]).to eq(2) # Expecting the third pattern (Subtotal) due to highest score
        end
      end
    end

    describe "#analyze_match_context" do
      let(:text) { "Start of document. Total: $123.45 End of document." }
      let(:match_data) { text.match(/Total: (\$\d+\.\d{2})/i) }

      it "returns correct context factors" do
        context_factors = operation.__send__(:analyze_match_context, match_data, :total_amount, text)
        expect(context_factors).to include(
          near_beginning: false,
          near_end: false,
          has_currency_nearby: true, # Corrected: $ is now included in the check via match[0]
          line_position: 0,
          surrounded_by_numbers: false
        )
      end

      context "when match is near the beginning" do
        let(:text) { "Total: $10.00 some other text." }
        let(:match_data) { text.match(/Total: (\$\d+\.\d{2})/i) }

        it "sets near_beginning to true" do
          context_factors = operation.__send__(:analyze_match_context, match_data, :total_amount, text)
          expect(context_factors[:near_beginning]).to be(true)
        end
      end

      context "when match is near the end" do
        let(:text) { "Some text near the end. Total: $99.99" }
        let(:match_data) { text.match(/Total: (\$\d+\.\d{2})/i) }

        it "sets near_end to true" do
          context_factors = operation.__send__(:analyze_match_context, match_data, :total_amount, text)
          expect(context_factors[:near_end]).to be(true)
        end
      end

      context "when no currency is nearby" do
        let(:text) { "Total: 10.00 without dollar sign" }
        let(:match_data) { text.match(/Total: (\d+\.\d{2})/i) }

        it "sets has_currency_nearby to false" do
          context_factors = operation.__send__(:analyze_match_context, match_data, :total_amount, text)
          expect(context_factors[:has_currency_nearby]).to be(false)
        end
      end

      context "when match is on a different line" do
        let(:text) { "Line 1\nLine 2\nTotal: $5.00" }
        let(:match_data) { text.match(/Total: (\$\d+\.\d{2})/i) }

        it "returns correct line_position" do
          context_factors = operation.__send__(:analyze_match_context, match_data, :total_amount, text)
          expect(context_factors[:line_position]).to eq(2)
        end
      end

      context "when not surrounded by numbers" do
        let(:text) { "Total: $50.00 No numbers around" }
        let(:match_data) { text.match(/Total: (\$\d+\.\d{2})/i) }

        it "sets surrounded_by_numbers to false" do
          context_factors = operation.__send__(:analyze_match_context, match_data, :total_amount, text)
          expect(context_factors[:surrounded_by_numbers]).to be(false)
        end
      end
    end

    describe "#context_nearby_has_numbers?" do
      it "returns true if numbers are in before text" do
        # Debugging `context_nearby_has_numbers?`
        before_text = "abc 123 def"
        after_text = "ghi"
        puts "[debug_context_nearby_has_numbers] before: '#{before_text}', after: '#{after_text}'"
        puts "[debug_context_nearby_has_numbers] nearby_text: '#{(before_text[-20..-1] || "") + (after_text[0..20] || "")}'"

        expect(operation.__send__(:context_nearby_has_numbers?, before_text, after_text)).to be(true)
      end

      it "returns true if numbers are in after text" do
        expect(operation.__send__(:context_nearby_has_numbers?, "abc", "123 def")).to be(true)
      end

      it "returns false if no numbers are nearby" do
        expect(operation.__send__(:context_nearby_has_numbers?, "abc", "def")).to be(false)
      end

      it "handles empty strings" do
        expect(operation.__send__(:context_nearby_has_numbers?, "", "")).to be(false)
      end
    end

    describe "#select_best_match" do
      let(:match1) { { value: "10.00", pattern_index: 0, confidence_factors: { near_end: false, has_currency_nearby: false, surrounded_by_numbers: false } } }
      let(:match2) { { value: "10.00", pattern_index: 1, confidence_factors: { near_end: false, has_currency_nearby: false, surrounded_by_numbers: false } } }
      let(:match3) { { value: "10.00", pattern_index: 2, confidence_factors: { near_end: true, has_currency_nearby: true, surrounded_by_numbers: true } } }

      it "returns the match with the highest score" do
        # Intentionally make match3 have a slightly higher potential score via its pattern_index and factors
        allow(operation).to receive(:calculate_match_score).and_call_original # Ensure actual scoring logic is used
        matches = [match1, match2, match3]
        best_match = operation.__send__(:select_best_match, matches, :total_amount)
        expect(best_match[:pattern_index]).to eq(2) # Expect match3 to be the best due to combined factors
        expect(best_match[:score]).to be_within(0.001).of(0.96) # Expecting score to be 0.96 based on calculation
      end

      it "returns nil if matches array is empty" do
        expect(operation.__send__(:select_best_match, [], :total_amount)).to be_nil
      end
    end

    describe "#calculate_match_score" do
      context "for :total_amount field" do
        let(:match) do
          {
            value: "100.00",
            pattern_index: 0,
            confidence_factors: {
              near_end: true,
              has_currency_nearby: true,
              surrounded_by_numbers: true
            }
          }
        end

        it "calculates score with bonuses for total_amount relevant factors" do
          score = operation.__send__(:calculate_match_score, match, :total_amount)
          # Base (0.5) + near_end (0.2) + has_currency_nearby (0.1) + surrounded_by_numbers (0.1) + pattern_priority (0.1 * (5-0)/5 = 0.1)
          # Total = 0.5 + 0.2 + 0.1 + 0.1 + 0.1 = 1.0
          expect(score).to eq(1.0)
        end
      end

      context "for :merchant field" do
        let(:match) do
          {
            value: "My Store Inc",
            pattern_index: 0,
            confidence_factors: {
              near_beginning: true
            }
          }
        end

        it "calculates score with bonuses for merchant relevant factors" do
          score = operation.__send__(:calculate_match_score, match, :merchant)
          # Base (0.5) + near_beginning (0.2) + multi-word (0.1) + pattern_priority (0.1)
          # Total = 0.5 + 0.2 + 0.1 + 0.1 = 0.9
          expect(score).to eq(0.9)
        end
      end

      context "for :date field" do
        let(:match) do
          {
            value: "2023-01-01",
            pattern_index: 0,
            confidence_factors: {
              near_beginning: true
            }
          }
        end

        it "calculates score with bonuses for date relevant factors" do
          score = operation.__send__(:calculate_match_score, match, :date)
          # Base (0.5) + near_beginning (0.1) + pattern_priority (0.1)
          # Total = 0.5 + 0.1 + 0.1 = 0.7
          expect(score).to eq(0.7)
        end
      end

      context "for an unknown field" do
        let(:match) do
          {
            value: "some value",
            pattern_index: 0,
            confidence_factors: {}
          }
        end

        it "returns score with only pattern priority bonus" do
          score = operation.__send__(:calculate_match_score, match, :unknown_field)
          # Base (0.5) + pattern_priority (0.1)
          # Total = 0.6
          expect(score).to eq(0.6)
        end
      end

      it "caps the score at 1.0" do
        match = {
          value: "100.00",
          pattern_index: 0,
          confidence_factors: {
            near_end: true,
            has_currency_nearby: true,
            surrounded_by_numbers: true
          }
        }
        score = operation.__send__(:calculate_match_score, match, :total_amount)
        expect(score).to eq(1.0)
      end

      it "rounds the score to 3 decimal places" do
        match = {
          value: "100.00",
          pattern_index: 4, # Low pattern_index to get non-integer score
          confidence_factors: {}
        }
        score = operation.__send__(:calculate_match_score, match, :total_amount)
        expect(score.to_s.split('.').last.length).to be <= 3
      end
    end

    describe "#validate_extracted_fields" do
      context "with valid extracted fields" do
        let(:extracted_fields_to_validate) do
          {
            total_amount: { value: "123.45", score: 0.9, pattern: /total/i, pattern_index: 0, position: 0.1, confidence_factors: { near_end: true } },
            date: { value: "2023-01-01", score: 0.8, pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/, pattern_index: 0, position: 0.5, confidence_factors: { near_beginning: true } },
            merchant: { value: "Test Store", score: 0.7, pattern: /^([A-Z\s&'.-]+)(?:\s+#\d+)?\s*$/m, pattern_index: 0, position: 0.9, confidence_factors: { near_beginning: true } }
          }
        end

        it "validates and formats fields correctly" do
          result = operation.__send__(:validate_extracted_fields, extracted_fields: extracted_fields_to_validate)
          expect(result).to be_success
          validated = result.value!
          expect(validated[:total_amount][:validated_value]).to eq(123.45)
          expect(validated[:total_amount][:formatted_value]).to eq("123.45")
          expect(validated[:date][:validated_value]).to eq(Date.parse("2023-01-01"))
          expect(validated[:date][:formatted_value]).to eq("2023-01-01")
          expect(validated[:merchant][:validated_value]).to eq("Test Store")
          expect(validated[:merchant][:formatted_value]).to eq("Test Store")
        end
      end

      context "with invalid or missing fields" do
        let(:extracted_fields_with_invalid) do
          {
            total_amount: { value: "-10.00", score: 0.9, pattern_index: 0, position: 0.1, confidence_factors: { near_end: true } }, # Invalid amount
            date: { value: "not-a-date", score: 0.8, pattern_index: 0, position: 0.2, confidence_factors: { near_beginning: true } },      # Invalid date
            merchant: { value: "A", score: 0.7, pattern_index: 0, position: 0.3, confidence_factors: { near_beginning: true } },           # Invalid merchant length
            store_number: { value: "123", score: 0.6, pattern_index: 0, position: 0.4, confidence_factors: {} }     # Valid, but passed through
          }
        end

        it "filters out invalid fields and passes through others" do
          result = operation.__send__(:validate_extracted_fields, extracted_fields: extracted_fields_with_invalid)
          expect(result).to be_success
          validated = result.value!
          expect(validated).not_to have_key(:total_amount)
          expect(validated).not_to have_key(:date)
          expect(validated).not_to have_key(:merchant)
          expect(validated).to have_key(:store_number) # Passed through
        end
      end
    end

    describe "#validate_amount" do
      it "returns formatted amount for valid input" do
        match = { value: "$123.45", score: 0.8 }
        validated = operation.__send__(:validate_amount, match)
        expect(validated[:validated_value]).to eq(123.45)
        expect(validated[:formatted_value]).to eq("123.45")
      end

      it "returns nil for zero or negative amount" do
        match = { value: "0.00", score: 0.8 }
        expect(operation.__send__(:validate_amount, match)).to be_nil

        match = { value: "-50.00", score: 0.8 }
        expect(operation.__send__(:validate_amount, match)).to be_nil
      end

      it "returns nil for amount outside reasonable range" do
        match = { value: "60000.00", score: 0.8 }
        expect(operation.__send__(:validate_amount, match)).to be_nil
      end

      it "returns nil for non-numeric value" do
        match = { value: "abc", score: 0.8 }
        expect(operation.__send__(:validate_amount, match)).to be_nil
      end

      it "returns nil if match or value is missing" do
        expect(operation.__send__(:validate_amount, nil)).to be_nil
        expect(operation.__send__(:validate_amount, {})).to be_nil
        expect(operation.__send__(:validate_amount, { value: nil })).to be_nil
      end
    end

    describe "#validate_date" do
      it "returns formatted date for valid input" do
        # Stub Date.current for consistent testing of date range
        allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))

        match = { value: "2023-01-01", score: 0.8 }
        validated = operation.__send__(:validate_date, match)
        expect(validated).not_to be_nil
        expect(validated[:validated_value]).to eq(Date.parse("2023-01-01"))
        expect(validated[:formatted_value]).to eq("2023-01-01")
      end

      it "returns nil for invalid date format" do
        # Stub Date.current for consistent testing of date range
        allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
        match = { value: "not-a-date", score: 0.8 }
        expect(operation.__send__(:validate_date, match)).to be_nil
      end

      it "returns nil for date too far in the past" do
        # Stub Date.current for consistent testing of date range
        allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
        match = { value: (Date.parse("2023-01-01") - 3.years).to_s, score: 0.8 }
        expect(operation.__send__(:validate_date, match)).to be_nil
      end

      it "returns nil for date too far in the future" do
        # Stub Date.current for consistent testing of date range
        allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
        match = { value: (Date.parse("2023-01-01") + 2.weeks).to_s, score: 0.8 }
        expect(operation.__send__(:validate_date, match)).to be_nil
      end

      it "returns nil if match or value is missing" do
        expect(operation.__send__(:validate_date, nil)).to be_nil
        expect(operation.__send__(:validate_date, {})).to be_nil
        expect(operation.__send__(:validate_date, { value: nil })).to be_nil
      end
    end

    describe "#validate_merchant" do
      it "returns formatted merchant for valid input" do
        match = { value: "  My grocery store  ", score: 0.8 }
        validated = operation.__send__(:validate_merchant, match)
        expect(validated[:validated_value]).to eq("My Grocery Store")
        expect(validated[:formatted_value]).to eq("My Grocery Store")
      end

      it "returns nil for very short merchant name" do
        match = { value: "A", score: 0.8 }
        expect(operation.__send__(:validate_merchant, match)).to be_nil
      end

      it "returns nil for very long merchant name" do
        match = { value: "A" * 51, score: 0.8 }
        expect(operation.__send__(:validate_merchant, match)).to be_nil
      end

      it "returns nil if match or value is missing" do
        expect(operation.__send__(:validate_merchant, nil)).to be_nil
        expect(operation.__send__(:validate_merchant, {})).to be_nil
        expect(operation.__send__(:validate_merchant, { value: nil })).to be_nil
      end
    end

    describe "#process_field_values" do
      let(:validated_fields_proc) do
        {
          total_amount: { value: "100.00", validated_value: 100.00, formatted_value: "100.00", score: 0.9, pattern: /total/i, pattern_index: 0, position: 0.1, confidence_factors: { near_end: true } },
          merchant: { value: "Test Store", validated_value: "Test Store", formatted_value: "Test Store", score: 0.8, pattern: /merchant/i, pattern_index: 0, position: 0.2, confidence_factors: { near_beginning: true } }
        }
      end

      it "transforms validated fields into processed fields" do
        result = operation.__send__(:process_field_values, validated_fields: validated_fields_proc)
        expect(result).to be_success
        processed = result.value!
        expect(processed[:total_amount]).to include(
          value: "100.00",
          confidence_score: 0.9,
          pattern_used: validated_fields_proc[:total_amount][:pattern], # Expect Regexp object directly
          extraction_method: "pattern_total_amount"
        )
        expect(processed[:merchant]).to include(
          value: "Test Store",
          confidence_score: 0.8,
          pattern_used: validated_fields_proc[:merchant][:pattern], # Expect Regexp object directly
          extraction_method: "pattern_merchant"
        )
      end

      context "when formatted_value is nil" do
        let(:validated_fields_no_format) do
          {
            other_field: { value: "raw data", score: 0.7, pattern: /other/ }
          }
        end

        it "uses raw value if formatted_value is nil" do
          result = operation.__send__(:process_field_values, validated_fields: validated_fields_no_format)
          expect(result).to be_success
          processed = result.value!
          expect(processed[:other_field][:value]).to eq("raw data")
        end
      end
    end

    describe "#suggest_category" do
      context "when merchant is present" do
        it "returns a category based on merchant" do
          processed_fields = { merchant: { value: "Walmart" } }
          result = operation.__send__(:suggest_category, processed_fields:)
          expect(result).to be_success
          expect(result.value!).to eq("Family")
        end
      end

      context "when merchant is not present" do
        it "returns default category 'Family'" do
          processed_fields = { total_amount: { value: "10.00" } }
          result = operation.__send__(:suggest_category, processed_fields:)
          expect(result).to be_success
          expect(result.value!).to eq("Family")
        end
      end

      context "when merchant leads to no specific category" do
        it "returns default category 'Family'" do
          processed_fields = { merchant: { value: "Random Shop" } }
          result = operation.__send__(:suggest_category, processed_fields:)
          expect(result).to be_success
          expect(result.value!).to eq("Family")
        end
      end
    end

    describe "#categorize_by_merchant" do
      it "returns Family for grocery merchants" do
        expect(operation.__send__(:categorize_by_merchant, "Walmart")).to eq("Family")
        expect(operation.__send__(:categorize_by_merchant, "Target")).to eq("Family")
      end

      it "returns Gas for fuel merchants" do
        expect(operation.__send__(:categorize_by_merchant, "Shell Gas")).to eq("Gas")
      end

      it "returns Food for restaurant merchants" do
        expect(operation.__send__(:categorize_by_merchant, "Starbucks Coffee")).to eq("Food")
      end

      it "returns Health for pharmacy merchants" do
        expect(operation.__send__(:categorize_by_merchant, "CVS Pharmacy")).to eq("Health")
      end

      it "returns Shopping for clothing/fashion merchants" do
        expect(operation.__send__(:categorize_by_merchant, "H&M Clothing")).to eq("Shopping")
      end

      it "returns Family as default for unknown merchants" do
        expect(operation.__send__(:categorize_by_merchant, "Unknown Shop")).to eq("Family")
      end
    end

    describe "#prepare_extraction_result" do
      let(:processed_fields_prep) do
        {
          total_amount: { value: "100.00" },
          merchant: { value: "Test Merchant" }
        }
      end
      let(:suggested_category_prep) { "Groceries" }

      before do
        allow(Time).to receive(:current).and_return(Time.parse("2023-01-01 15:00:00 UTC"))
      end

      it "prepares the final extraction result hash" do
        result = operation.__send__(
          :prepare_extraction_result,
          processed_fields: processed_fields_prep,
          suggested_category: suggested_category_prep
        )
        expect(result).to be_success
        expect(result.value!).to eq(
          extracted_fields: processed_fields_prep,
          suggested_category: suggested_category_prep,
          extraction_metadata: {
            total_fields_found: 2,
            has_essential_data: true,
            extraction_timestamp: Time.parse("2023-01-01 15:00:00 UTC"),
            processing_method: "tesseract_pattern_matching"
          }
        )
      end

      context "when essential data is missing" do
        let(:processed_fields_no_essential) { { date: { value: "2023-01-01" } } }

        it "sets has_essential_data to false" do
          result = operation.__send__(
            :prepare_extraction_result,
            processed_fields: processed_fields_no_essential,
            suggested_category: suggested_category_prep
          )
          expect(result).to be_success
          expect(result.value![:extraction_metadata][:has_essential_data]).to be(false)
        end
      end
    end

    describe "#has_essential_data?" do
      it "returns true if merchant is present" do
        fields = { merchant: { value: "Test" } }
        expect(operation.__send__(:has_essential_data?, fields)).to be(true)
      end

      it "returns true if total_amount is present" do
        fields = { total_amount: { value: "10.00" } }
        expect(operation.__send__(:has_essential_data?, fields)).to be(true)
      end

      it "returns true if both merchant and total_amount are present" do
        fields = { merchant: { value: "Test" }, total_amount: { value: "10.00" } }
        expect(operation.__send__(:has_essential_data?, fields)).to be(true)
      end

      it "returns false if neither merchant nor total_amount is present" do
        fields = { date: { value: "2023-01-01" } }
        expect(operation.__send__(:has_essential_data?, fields)).to be(false)
      end

      it "returns false if fields is empty" do
        expect(operation.__send__(:has_essential_data?, {})).to be(false)
      end
    end
  end
end
