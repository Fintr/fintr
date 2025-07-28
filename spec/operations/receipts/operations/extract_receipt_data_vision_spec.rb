# frozen_string_literal: true

require "rails_helper"
require "openai"
require "fileutils"
require "base64"

RSpec.describe Receipts::Operations::ExtractReceiptDataVision, type: :operation do
  subject(:operation) { described_class.new }

  let(:image_path) { Rails.root.join("spec/fixtures/files/test_receipt.jpg").to_s }
  let(:space) { create(:personal_space) }
  let(:space_id) { space.id }

  # Ensure the test image exists for validation
  before do
    # Create a dummy image file for testing if it doesn't exist
    unless File.exist?(image_path)
      FileUtils.mkdir_p(File.dirname(image_path))
      File.write(image_path, "dummy image data")
    end
  end

  after do
    # Clean up the dummy image file after tests
    File.delete(image_path) if File.exist?(image_path)
  end

  describe "Contract" do
    context "with valid parameters" do
      let(:params) { { image_path:, space_id: } }

      before do
        allow(Spaces::Space).to receive(:find_by).and_return(space)
      end

      it "is successful" do
        result = operation.validate(params:)
        expect(result).to be_success
        expect(result.value!).to include(image_path:, space_id:)
      end
    end

    context "with invalid image_path" do
      context "when image_path is missing" do
        let(:params) { { space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['is missing'])
        end
      end

      context "when image_path is not a string" do
        let(:params) { { image_path: 123, space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['must be a string'])
        end
      end

      context "when file does not exist" do
        let(:params) { { image_path: "/path/to/non_existent_file.jpg", space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['file does not exist'])
        end
      end

      context "when file is not an image" do
        let(:non_image_path) { Rails.root.join("spec/fixtures/files/not_an_image.txt").to_s }
        let(:params) { { image_path: non_image_path, space_id: } }

        before do
          File.write(non_image_path, "this is not an image")
        end

        after do
          File.delete(non_image_path) if File.exist?(non_image_path)
        end

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['must be an image file'])
        end
      end
    end

    context "with invalid space_id" do
      context "when space_id is missing" do
        let(:params) { { image_path: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['is missing'])
        end
      end

      context "when space_id is not a string" do
        let(:params) { { image_path:, space_id: 123 } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['must be a string'])
        end
      end

      context "when space does not exist" do
        let(:params) { { image_path:, space_id: "non_existent_space_id" } }

        before do
          allow(Spaces::Space).to receive(:exists?).and_return(false)
        end

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['must be a valid space'])
        end
      end
    end
  end

  describe "#call" do
    let(:params) do
      {
        image_path:,
        space_id:
      }
    end
    let(:base64_image) { "data:image/jpeg;base64,dummy_base64_image_data" }
    let(:space_categories) { ["Groceries", "Restaurants"] }
    let(:ai_response_content) do
      <<~JSON
        {"total_amount": "50.00", "category": "Groceries", "confidence": "high", "merchant_detected": "Whole Foods"}
      JSON
    end
    let(:parsed_data) do
      {
        "total_amount" => "50.00",
        "category" => "Groceries",
        "confidence" => "high",
        "merchant_detected" => "Whole Foods"
      }
    end
    let(:validated_data) do
      {
        total_amount: { value: "50.00", confidence_score: 0.90 },
        category: { value: "Groceries", confidence_score: 0.90 },
        merchant: { value: "Whole Foods", confidence_score: 0.90 }
      }
    end
    let(:final_result) do
      {
        extracted_fields: validated_data,
        suggested_category: "Groceries"
      }
    end

    before do
      # Global OpenAI mock setup for #call block
      mock_openai_client = instance_double(OpenAI::Client)
      allow(OpenAI::Client).to receive(:new).and_return(mock_openai_client)
      allow(mock_openai_client).to receive(:chat).and_return({
        "choices" => [
          {
            "message" => {
              "content" => ai_response_content
            }
          }
        ]
      })
      allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("dummy_openai_key")
    end

    context "when all steps are successful" do
      before do
        # Mock external dependencies for a successful full flow
        allow(Spaces::Space).to receive(:find).with(space_id).and_return(space) # Use find method
        allow(space).to receive(:expense_categories).and_return(instance_double(ActiveRecord::Relation, pluck: space_categories))
        allow(File).to receive(:binread).with(image_path).and_return("dummy image data")
        allow(Base64).to receive(:strict_encode64).and_return("ZHVtbXkgaW1hZ2UgZGF0YQ==")

        # These are internal methods of the operation, no longer stubbed on 'operation'
        # allow(operation).to receive(:parse_ai_response).and_return(Dry::Monads::Success(parsed_data))
        # allow(operation).to receive(:validate_extracted_data).and_return(Dry::Monads::Success(validated_data))
        # allow(operation).to receive(:prepare_extraction_result).and_return(Dry::Monads::Success(final_result))
      end

      it "returns a successful result with extracted data" do
        result = operation.call(params:)
        expect(result).to be_success
        expect(result.value!).to eq(final_result)
      end
    end

    context "when a step fails" do
      context "when find_space fails" do
        before do
          # Simulate Space not found by find method
          allow(Spaces::Space).to receive(:find).with(space_id).and_raise(ActiveRecord::RecordNotFound)
        end

        it "returns a failure" do
          result = operation.call(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_error: 'Space not found', error: instance_of(ActiveRecord::RecordNotFound))
        end
      end

      context "when fetch_space_categories fails" do
        let(:mock_space_for_categories) { instance_double(Spaces::Space) }

        before do
          # Simulate find_space succeeding with a mock space, then its categories failing
          allow(Spaces::Space).to receive(:find).with(space_id).and_return(mock_space_for_categories)
          allow(mock_space_for_categories).to receive(:expense_categories).and_raise(StandardError, "Database error for categories")
        end

        it "returns a failure" do
          result = operation.call(params:)
          expect(result).to be_failure
          expect(result.failure).to include(categories_error: 'Failed to fetch categories', error: instance_of(StandardError))
        end
      end

      context "when encode_image_to_base64 fails" do
        before do
          # Simulate an error when reading the image file
          allow(File).to receive(:binread).and_raise(StandardError, "File read error")
        end

        it "returns a failure" do
          result = operation.call(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_encoding_error: 'Failed to encode image', error: instance_of(StandardError))
        end
      end

      context "when call_openai_vision_api fails" do
        before do
          # Simulate an error during the OpenAI API call
          mock_openai_client = instance_double(OpenAI::Client)
          allow(OpenAI::Client).to receive(:new).and_return(mock_openai_client)
          allow(mock_openai_client).to receive(:chat).and_raise(StandardError, "API error")
          allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("dummy_openai_key")
        end

        it "returns a failure" do
          result = operation.call(params:)
          expect(result).to be_failure
          expect(result.failure).to include(ai_vision_error: 'OpenAI Vision API call failed', error: instance_of(StandardError))
        end
      end

      context "when parse_ai_response fails" do
        # No before block needed, as ai_response_content is directly defined to be invalid
        let(:ai_response_content) { "this is not json" }

        it "returns a failure" do
          result = operation.call(params:)
          expect(result).to be_failure
          # The actual error from parse_ai_response is different, as the downstream steps will also fail
          # I need to ensure that the AI response content results in the expected parse_error and that
          # the overall failure matches what the operation returns from that point on.
          expect(result.failure).to include(parse_error: 'No valid JSON found in AI response')
        end
      end
    end
  end

  describe "Private Methods" do
    describe "#find_space" do
      context "when space exists" do
        it "returns success with the space" do
          result = operation.__send__(:find_space, params: { space_id: space.id })
          expect(result).to be_success
          expect(result.value!).to be_a(Spaces::Space)
          expect(result.value!).to eq(space)
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
        # Ensure categories are created before each test in this describe block
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
        let(:space_without_categories) { create(:space) }

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

    describe "#encode_image_to_base64" do
      let(:test_image_path) { Rails.root.join("spec/fixtures/files/test_image.png").to_s }

      before do
        # Create a dummy PNG image file for testing
        File.write(test_image_path, "dummy png image data")
      end

      after do
        File.delete(test_image_path) if File.exist?(test_image_path)
      end

      context "with a valid image path" do
        it "encodes the image to base64 successfully" do
          allow(File).to receive(:binread).with(test_image_path).and_return("dummy png image data")
          allow(Base64).to receive(:strict_encode64).and_return("ZHVtbXkgcG5nIGltYWdlIGRhdGE=") # Base64 of "dummy png image data"

          result = operation.__send__(:encode_image_to_base64, params: { image_path: test_image_path })
          expect(result).to be_success
          expect(result.value!).to start_with("data:image/png;base64,")
          expect(result.value!).to include("ZHVtbXkgcG5nIGltYWdlIGRhdGE=")
        end
      end

      context "when image file read fails" do
        before do
          allow(File).to receive(:binread).and_raise(StandardError, "File read error")
        end

        it "returns failure" do
          result = operation.__send__(:encode_image_to_base64, params: { image_path: test_image_path })
          expect(result).to be_failure
          expect(result.failure).to include(image_encoding_error: 'Failed to encode image')
        end
      end
    end

    describe "#determine_mime_type" do
      it "returns correct mime type for .jpg" do
        expect(operation.__send__(:determine_mime_type, "image.jpg")).to eq("image/jpeg")
      end

      it "returns correct mime type for .jpeg" do
        expect(operation.__send__(:determine_mime_type, "image.jpeg")).to eq("image/jpeg")
      end

      it "returns correct mime type for .png" do
        expect(operation.__send__(:determine_mime_type, "image.png")).to eq("image/png")
      end

      it "returns correct mime type for .bmp" do
        expect(operation.__send__(:determine_mime_type, "image.bmp")).to eq("image/bmp")
      end

      it "returns correct mime type for .tiff" do
        expect(operation.__send__(:determine_mime_type, "image.tiff")).to eq("image/tiff")
      end

      it "returns correct mime type for .tif" do
        expect(operation.__send__(:determine_mime_type, "image.tif")).to eq("image/tiff")
      end

      it "returns default mime type for unknown extension" do
        expect(operation.__send__(:determine_mime_type, "document.pdf")).to eq("image/jpeg")
      end
    end

    describe "#call_openai_vision_api" do
      let(:base64_image) { "data:image/jpeg;base64,dummy_base64_image_data" }
      let(:space_categories) { ["Food", "Transport"] }
      let(:mock_openai_client) { instance_double(OpenAI::Client) }
      let(:mock_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => <<~JSON
                  {"total_amount": "50.00", "category": "Food", "confidence": "high"}
                JSON
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
        result = operation.__send__(:call_openai_vision_api, base64_image:, space_categories:)
        expect(result).to be_success
        expect(result.value!).to eq("{\"total_amount\": \"50.00\", \"category\": \"Food\", \"confidence\": \"high\"}")
      end

      context "when OpenAI API returns no content" do
        before do
          allow(mock_openai_client).to receive(:chat).and_return({ "choices" => [{ "message" => { "content" => nil } }] })
        end

        it "returns failure" do
          result = operation.__send__(:call_openai_vision_api, base64_image:, space_categories:)
          expect(result).to be_failure
          expect(result.failure).to include(ai_error: 'No response from OpenAI Vision')
        end
      end

      context "when OpenAI API call fails" do
        before do
          allow(mock_openai_client).to receive(:chat).and_raise(StandardError, "API error")
        end

        it "returns failure" do
          result = operation.__send__(:call_openai_vision_api, base64_image:, space_categories:)
          expect(result).to be_failure
          expect(result.failure).to include(ai_vision_error: 'OpenAI Vision API call failed')
        end
      end
    end

    describe "#build_vision_system_prompt" do
      let(:space_categories) { ["Groceries", "Dining", "Transport"] }

      it "builds the system prompt correctly with categories" do
        result = operation.__send__(:build_vision_system_prompt, space_categories)
        expect(result).to include("Extract the transaction DATE from the receipt")
        expect(result).to include("ALWAYS provide a category suggestion")
        expect(result).to include("default to \"Groceries\"")
        expect(result).to include("date\": \"YYYY-MM-DD\"")
        expect(result).to include("Groceries, Dining, Transport")
      end

      context "when space_categories is empty" do
        let(:space_categories) { [] }

        it "builds the system prompt with default category 'Family'" do
          result = operation.__send__(:build_vision_system_prompt, [])
          expect(result).to include("ALWAYS provide a category suggestion")
          expect(result).to include("default to \"Family\"")
          expect(result).to include("date\": \"YYYY-MM-DD\"")
        end
      end
    end

    describe "#parse_ai_response" do
      context "with valid JSON response" do
        let(:ai_response) do
          <<~JSON
            {"total_amount": "50.00", "category": "Food", "confidence": "high"}
          JSON
        end

        it "parses the JSON successfully" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_success
          expect(result.value!).to eq(JSON.parse(ai_response))
        end
      end

      context "with JSON wrapped in other text" do
        let(:ai_response) do
          <<~JSON_WRAP
            ```json
            {"total_amount": "50.00", "category": "Food"}
            ```
          JSON_WRAP
        end

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
        let(:ai_response) { '{total_amount: "50.00"}' } # This is indeed malformed JSON

        it "returns failure" do
          result = operation.__send__(:parse_ai_response, ai_response:)
          expect(result).to be_failure
          expect(result.failure).to include(parse_error: "Could not parse JSON from AI response", raw_response: ai_response)
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
            "total_amount" => "123.45",
            "category" => "Groceries",
            "confidence" => "high",
            "merchant_detected" => "ShopRite"
          }
        end

        it "returns success with validated data" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value!).to include(
            total_amount: { value: "123.45", confidence_score: 0.90 },
            category: { value: "Groceries", confidence_score: 0.90 },
            merchant: { value: "ShopRite", confidence_score: 0.90 }
          )
        end
      end

      context "with nil parsed_data" do
        let(:parsed_data) { nil }

        it "returns failure" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_failure
          expect(result.failure).to eq('Parsed data is missing')
        end
      end

      context "with missing total_amount" do
        let(:parsed_data_without_total) do
          {
            "category" => "Dining",
            "confidence" => "medium",
            "merchant_detected" => "Restaurant"
          }
        end

        it "returns success without total_amount but with category" do
          result = operation.__send__(:validate_extracted_data, parsed_data: parsed_data_without_total, space_categories:)
          expect(result).to be_success
          expect(result.value!).to include(:category)
          expect(result.value!).not_to include(:total_amount)
          expect(result.value![:category][:confidence_score]).to eq(0.75) # Category confidence is maintained
        end
      end

      context "with invalid total_amount" do
        let(:parsed_data) do
          {
            "total_amount" => "abc", # Invalid amount
            "category" => "Groceries",
            "confidence" => "high",
            "merchant_detected" => "ShopRite"
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
            "confidence" => "high",
            "merchant_detected" => "Cafe"
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
            "confidence" => "high",
            "merchant_detected" => "Best Buy"
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
            "confidence" => "high",
            "merchant_detected" => "ShopRite"
          }
        end

        it "returns success with the correctly cased category" do
          result = operation.__send__(:validate_extracted_data, parsed_data:, space_categories:)
          expect(result).to be_success
          expect(result.value![:category][:value]).to eq("Groceries")
        end
      end
    end

    describe "#clean_amount" do
      it "returns float for valid string amount" do
        expect(operation.__send__(:clean_amount, "123.45")).to eq(123.45)
      end

      it "returns float for string with currency symbol" do
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

      it "returns float for negative amount" do
        expect(operation.__send__(:clean_amount, "-10.00")).to eq(10.0)
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

    describe "#vision_confidence_to_score" do
      it "returns 0.90 for 'high'" do
        expect(operation.__send__(:vision_confidence_to_score, "high")).to eq(0.90)
      end

      it "returns 0.75 for 'medium'" do
        expect(operation.__send__(:vision_confidence_to_score, "medium")).to eq(0.75)
      end

      it "returns 0.55 for 'low'" do
        expect(operation.__send__(:vision_confidence_to_score, "low")).to eq(0.55)
      end

      it "returns 0.80 for unknown or nil confidence" do
        expect(operation.__send__(:vision_confidence_to_score, "unknown")).to eq(0.80)
        expect(operation.__send__(:vision_confidence_to_score, nil)).to eq(0.80)
      end
    end

    describe "#prepare_extraction_result" do
      context "with validated data including category" do
        let(:validated_data_with_category) do
          {
            total_amount: { value: "100.00", confidence_score: 0.9 },
            category: { value: "Groceries", confidence_score: 0.9 },
            merchant: { value: "Store A", confidence_score: 0.9 }
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
            total_amount: { value: "50.00", confidence_score: 0.8 },
            merchant: { value: "Store B", confidence_score: 0.8 }
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
