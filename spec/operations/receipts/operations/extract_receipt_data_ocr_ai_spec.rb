# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::ExtractReceiptDataOcrAi, type: :operation do
  subject(:operation) { described_class.new }

  let(:space) { create(:personal_space) }
  let(:space_id) { space.id }
  let(:ocr_text) { "Total: $100.00\nGroceries\nDate: #{Date.current}" }

  describe "Contract" do
    context "with valid parameters" do
      let(:params) { { ocr_text:, space_id: } }

      it "is successful" do
        result = operation.validate(params:)
        expect(result).to be_success
        expect(result.value!).to include(ocr_text:, space_id:)
      end
    end

    context "with invalid ocr_text" do
      context "when ocr_text is missing" do
        let(:params) { { space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['is missing'])
        end
      end

      context "when ocr_text is blank" do
        let(:params) { { ocr_text: "", space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['cannot be blank'])
        end
      end

      context "when ocr_text is not a string" do
        let(:params) { { ocr_text: 123, space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ocr_text: ['must be a string'])
        end
      end
    end

    context "with invalid space_id" do
      context "when space_id is missing" do
        let(:params) { { ocr_text: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['is missing'])
        end
      end

      context "when space_id is not a string" do
        let(:params) { { ocr_text:, space_id: 123 } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['must be a string'])
        end
      end

      context "when space does not exist" do
        let(:params) { { ocr_text:, space_id: "non_existent_space_id" } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['must be a valid space'])
        end
      end
    end
  end

  describe "#call" do
    let(:space_categories) { ["Groceries", "Restaurants"] }
    let(:ai_response_content) { "{\"total_amount\": \"100.00\", \"category\": \"Groceries\", \"confidence\": \"high\"}" }
    let(:parsed_data) do
      {
        "total_amount" => "100.00",
        "category" => "Groceries",
        "confidence" => "high"
      }
    end
    let(:validated_data) do
      {
        total_amount: { value: "100.00", confidence_score: 0.85 },
        category: { value: "Groceries", confidence_score: 0.85 }
      }
    end
    let(:final_result) do
      {
        extracted_fields: validated_data,
        suggested_category: "Groceries"
      }
    end

    before do
      allow(operation).to receive(:validate).and_return(Dry::Monads::Success({ ocr_text:, space_id: }))
      allow(operation).to receive(:find_space).and_return(Dry::Monads::Success(space))
      allow(operation).to receive(:fetch_space_categories).and_return(Dry::Monads::Success(space_categories))
      allow(operation).to receive(:call_openai_api).and_return(Dry::Monads::Success(ai_response_content))
      allow(operation).to receive(:parse_ai_response).and_return(Dry::Monads::Success(parsed_data))
      allow(operation).to receive(:validate_extracted_data).and_return(Dry::Monads::Success(validated_data))
      allow(operation).to receive(:prepare_extraction_result).and_return(Dry::Monads::Success(final_result))
    end

    context "when all steps are successful" do
      it "returns a successful result with extracted data" do
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_success
        expect(result.value!).to eq(final_result)
      end
    end

    context "when a step fails" do
      it "returns a failure if find_space fails" do
        allow(operation).to receive(:find_space).and_return(Dry::Monads::Failure(error: 'Space not found'))
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Space not found')
      end

      it "returns a failure if fetch_space_categories fails" do
        allow(operation).to receive(:fetch_space_categories).and_return(Dry::Monads::Failure(error: 'Failed to fetch categories'))
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Failed to fetch categories')
      end

      it "returns a failure if call_openai_api fails" do
        allow(operation).to receive(:call_openai_api).and_return(Dry::Monads::Failure(error: 'OpenAI API call failed'))
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'OpenAI API call failed')
      end

      it "returns a failure if parse_ai_response fails" do
        allow(operation).to receive(:parse_ai_response).and_return(Dry::Monads::Failure(error: 'Failed to parse AI response'))
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Failed to parse AI response')
      end

      it "returns a failure if validate_extracted_data fails" do
        allow(operation).to receive(:validate_extracted_data).and_return(Dry::Monads::Failure(error: 'Failed to validate extracted data'))
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Failed to validate extracted data')
      end

      it "returns a failure if prepare_extraction_result fails" do
        allow(operation).to receive(:prepare_extraction_result).and_return(Dry::Monads::Failure(error: 'Failed to prepare result'))
        result = operation.call(params: { ocr_text:, space_id: })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Failed to prepare result')
      end
    end
  end

  describe "Private Methods" do
    describe "#find_space" do
      let(:space_to_find) { create(:personal_space) }

      context "when space exists" do
        it "returns success with the space" do
          result = operation.__send__(:find_space, params: { space_id: space_to_find.id })
          expect(result).to be_success
          expect(result.value!).to eq(space_to_find)
        end
      end

      context "when space does not exist" do
        it "returns failure" do
          result = operation.__send__(:find_space, params: { space_id: "non_existent_id" })
          expect(result).to be_failure
          expect(result.failure).to include(space_error: 'Space not found')
        end
      end
    end

    describe "#fetch_space_categories" do
      let(:category1) { create(:category, name: "Food", space:, category_type: "expense") }
      let(:category2) { create(:category, name: "Travel", space:, category_type: "expense") }

      before do
        category1
        category2
      end

      context "when space has expense categories" do
        it "returns success with the categories" do
          result = operation.__send__(:fetch_space_categories, space:)
          expect(result).to be_success
          expect(result.value!).to contain_exactly("Food", "Travel")
        end
      end

      context "when space has no expense categories" do
        let(:space_without_categories) { create(:personal_space) }

        it "returns success with default categories" do
          result = operation.__send__(:fetch_space_categories, space: space_without_categories)
          expect(result).to be_success
          expect(result.value!).to match_array(Transactions::Category::DEFAULT_EXPENSE_CATEGORIES)
        end
      end

      context "when an error occurs" do
        before do
          allow(space).to receive(:expense_categories).and_raise(StandardError, "Database error")
        end

        it "returns failure with an error message" do
          result = operation.__send__(:fetch_space_categories, space:)
          expect(result).to be_failure
          expect(result.failure).to include(categories_error: 'Failed to fetch categories')
        end
      end
    end

    describe "#call_openai_api" do
      let(:mock_openai_client) { instance_double(OpenAI::Client) }
      let(:mock_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => "{\"total_amount\": \"100.00\", \"category\": \"Groceries\", \"confidence\": \"high\"}"
              }
            }
          ]
        }
      end

      before do
        allow(OpenAI::Client).to receive(:new).and_return(mock_openai_client)
        allow(mock_openai_client).to receive(:chat).and_return(mock_response)
        allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("dummy_openai_key")
      end

      it "calls OpenAI API and returns success with content" do
        space_categories = ["Groceries"]
        result = operation.__send__(:call_openai_api, params: { ocr_text: "some text" }, space_categories:)
        expect(result).to be_success
        expect(result.value!).to eq("{\"total_amount\": \"100.00\", \"category\": \"Groceries\", \"confidence\": \"high\"}")
      end

      context "when OpenAI API returns no content" do
        before do
          allow(mock_openai_client).to receive(:chat).and_return({ "choices" => [{ "message" => { "content" => nil } }] })
        end

        it "returns failure" do
          space_categories = ["Groceries"]
          result = operation.__send__(:call_openai_api, params: { ocr_text: "some text" }, space_categories:)
          expect(result).to be_failure
          expect(result.failure).to include(ai_error: 'No response from OpenAI')
        end
      end

      context "when OpenAI API call fails" do
        before do
          allow(mock_openai_client).to receive(:chat).and_raise(StandardError, "API error")
        end

        it "returns failure" do
          space_categories = ["Groceries"]
          result = operation.__send__(:call_openai_api, params: { ocr_text: "some text" }, space_categories:)
          expect(result).to be_failure
          expect(result.failure).to include(ai_error: 'OpenAI API call failed')
        end
      end
    end

    describe "#build_system_prompt" do
      let(:space_categories) { ["Groceries", "Dining", "Transport"] }

      it "builds the system prompt correctly with categories" do
        prompt = operation.__send__(:build_system_prompt, space_categories)
        expect(prompt).to include("Extract the transaction DATE from the receipt text")
        expect(prompt).to include("ALWAYS provide a category suggestion")
        expect(prompt).to include("default to \"Groceries\"")
        expect(prompt).to include("date\": \"YYYY-MM-DD\"")
        expect(prompt).to include("Groceries, Dining, Transport")
      end

      context "when space_categories is empty" do
        let(:space_categories) { [] }

        it "builds the system prompt with default category 'Family'" do
          prompt = operation.__send__(:build_system_prompt, [])
          expect(prompt).to include("ALWAYS provide a category suggestion")
          expect(prompt).to include("default to \"Family\"")
          expect(prompt).to include("date\": \"YYYY-MM-DD\"")
        end
      end
    end

    describe "#build_user_prompt" do
      it "builds the user prompt correctly" do
        ocr_text_sample = "Some receipt text here."
        prompt = operation.__send__(:build_user_prompt, ocr_text_sample)
        expect(prompt).to eq("Extract total amount and category from this receipt text:\n\nSome receipt text here.")
      end
    end

    describe "#parse_ai_response" do
      context "with valid JSON response" do
        let(:ai_response) { '{"total_amount": "100.00", "category": "Groceries", "confidence": "high"}' }

        it "parses the JSON successfully" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_success
          expect(result.value!).to eq(JSON.parse(ai_response))
        end
      end

      context "with JSON wrapped in other text" do
        let(:ai_response) { "```json\n{\"total_amount\": \"50.00\", \"category\": \"Food\"}\n```" }

        it "extracts and parses the JSON successfully" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_success
          expect(result.value!).to eq({ "total_amount" => "50.00", "category" => "Food" })
        end
      end

      context "with invalid JSON response" do
        let(:ai_response) { "this is not json" }

        it "returns failure" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_failure
          expect(result.failure).to include(parse_error: 'No valid JSON found in AI response')
        end
      end

      context "with malformed JSON" do
        let(:ai_response) { '{total_amount: "50.00"}' } # Missing quotes around key

        it "returns failure" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_failure
          expect(result.failure).to include(parse_error: 'Could not parse JSON from AI response')
        end
      end

      context "when response is not a hash" do
        let(:ai_response) { '["item1", "item2"]' } # Valid JSON, but not a hash

        it "returns failure" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_failure
          expect(result.failure).to include(parse_error: 'AI response is not a valid JSON object')
        end
      end
    end

    describe "#validate_extracted_data" do
      let(:space_categories) { ["Groceries", "Dining", "Transportation", "Family"] }

      context "with valid extracted data" do
        let(:parsed_data) do
          {
            "total_amount" => "100.00",
            "category" => "Groceries",
            "confidence" => "high"
          }
        end

        it "returns success with validated data" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value!).to include(
            total_amount: { value: "100.00", confidence_score: 0.85 },
            category: { value: "Groceries", confidence_score: 0.85 }
          )
        end
      end

      context "with missing total_amount" do
        let(:parsed_data_without_total) do
          {
            "category" => "Dining",
            "confidence" => "medium"
          }
        end

        it "returns success without total_amount but with category" do
          result = operation.__send__(:validate_extracted_data, parsed_data: parsed_data_without_total, space_categories:)
          expect(result).to be_success
          expect(result.value!).to include(:category)
          expect(result.value!).not_to include(:total_amount)
          expect(result.value![:category][:confidence_score]).to eq(0.65) # Category confidence is maintained
        end
      end

      context "with invalid total_amount" do
        let(:parsed_data) do
          {
            "total_amount" => "abc",
            "category" => "Groceries",
            "confidence" => "high"
          }
        end

        it "returns success without total_amount" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value!).not_to have_key(:total_amount)
        end
      end

      context "with missing category" do
        let(:parsed_data) do
          {
            "total_amount" => "10.00",
            "confidence" => "high"
          }
        end

        it "returns success with default category 'Groceries'" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value![:category][:value]).to eq("Groceries")
        end
      end

      context "with category not in space_categories" do
        let(:parsed_data) do
          {
            "total_amount" => "25.00",
            "category" => "Electronics", # Not in space_categories
            "confidence" => "high"
          }
        end

        it "returns success with default category 'Groceries'" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value![:category][:value]).to eq("Groceries")
        end
      end

      context "with a case-insensitive category match" do
        let(:parsed_data) do
          {
            "total_amount" => "25.00",
            "category" => "groceries", # Lowercase
            "confidence" => "high"
          }
        end

        it "returns success with the correctly cased category" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value![:category][:value]).to eq("Groceries")
        end
      end

      context "with nil parsed_data" do
        let(:parsed_data) { nil }

        it "returns an empty hash with no errors if parsed_data is nil" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value!).to eq({})
        end
      end
    end

    describe "#clean_amount" do
      it "extracts amount from string value" do
        expect(operation.__send__(:clean_amount, "$123.45")).to eq(123.45)
      end

      it "returns nil for blank string" do
        expect(operation.__send__(:clean_amount, "")).to be_nil
      end

      it "returns nil for nil" do
        expect(operation.__send__(:clean_amount, nil)).to be_nil
      end

      it "returns nil for 'null' string" do
        expect(operation.__send__(:clean_amount, "null")).to be_nil
      end

      it "returns nil for non-numeric string" do
        expect(operation.__send__(:clean_amount, "abc")).to be_nil
      end

      it "returns nil for zero amount" do
        expect(operation.__send__(:clean_amount, "0.00")).to be_nil
      end

      it "returns nil for negative amount" do
        expect(operation.__send__(:clean_amount, "-10.00")).to be_nil
      end
    end

    describe "#clean_category" do
      let(:space_categories) { ["Groceries", "Dining", "Transportation", "Family"] }

      context "with exact match" do
        it "returns the category" do
          expect(operation.__send__(:clean_category, "Groceries", space_categories)).to eq("Groceries")
        end
      end

      context "with case-insensitive match" do
        it "returns the correctly cased category" do
          expect(operation.__send__(:clean_category, "groceries", space_categories)).to eq("Groceries")
        end
      end

      context "with no match" do
        it "returns the first space category as default if available" do
          expect(operation.__send__(:clean_category, "Electronics", space_categories)).to eq("Groceries")
        end

        it "returns 'Family' if space categories are empty" do
          expect(operation.__send__(:clean_category, "Electronics", [])).to eq("Family")
        end
      end

      context "with blank category string" do
        it "returns the first space category as default" do
          expect(operation.__send__(:clean_category, "", space_categories)).to eq("Groceries")
        end
      end

      context "with nil category string" do
        it "returns the first space category as default" do
          expect(operation.__send__(:clean_category, nil, space_categories)).to eq("Groceries")
        end
      end

      context "with 'null' category string" do
        it "returns the first space category as default" do
          expect(operation.__send__(:clean_category, "null", space_categories)).to eq("Groceries")
        end
      end
    end

    describe "#confidence_to_score" do
      it "returns 0.85 for 'high'" do
        expect(operation.__send__(:confidence_to_score, "high")).to eq(0.85)
      end

      it "returns 0.65 for 'medium'" do
        expect(operation.__send__(:confidence_to_score, "medium")).to eq(0.65)
      end

      it "returns 0.45 for 'low'" do
        expect(operation.__send__(:confidence_to_score, "low")).to eq(0.45)
      end

      it "returns 0.60 for unknown or nil confidence" do
        expect(operation.__send__(:confidence_to_score, "unknown")).to eq(0.60)
        expect(operation.__send__(:confidence_to_score, nil)).to eq(0.60)
      end
    end

    describe "#prepare_extraction_result" do
      context "with validated data including category" do
        let(:validated_data_with_category) do
          {
            total_amount: { value: "100.00", confidence_score: 0.85 },
            category: { value: "Groceries", confidence_score: 0.85 }
          }
        end

        it "returns success with extracted fields and suggested category" do
          result = operation.__send__(:prepare_extraction_result, validated_data: validated_data_with_category)
          expect(result).to be_success
          expect(result.value!).to eq(
            extracted_fields: validated_data_with_category,
            suggested_category: "Groceries"
          )
        end
      end

      context "with validated data missing category" do
        let(:validated_data_without_category) do
          {
            total_amount: { value: "50.00", confidence_score: 0.65 }
          }
        end

        it "returns success with extracted fields and 'Family' as suggested category" do
          result = operation.__send__(:prepare_extraction_result, validated_data: validated_data_without_category)
          expect(result).to be_success
          expect(result.value!).to eq(
            extracted_fields: validated_data_without_category,
            suggested_category: "Family"
          )
        end
      end

      context "with empty validated data" do
        let(:empty_validated_data) { {} }

        it "returns success with empty extracted fields and 'Family' as suggested category" do
          result = operation.__send__(:prepare_extraction_result, validated_data: empty_validated_data)
          expect(result).to be_success
          expect(result.value!).to eq(
            extracted_fields: {},
            suggested_category: "Family"
          )
        end
      end
    end
  end
end
