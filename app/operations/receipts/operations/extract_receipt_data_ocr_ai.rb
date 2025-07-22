# frozen_string_literal: true

module Receipts
  module Operations
    class ExtractReceiptDataOcrAi < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:ocr_text).value(:string)
          required(:space_id).value(:string)
        end

        rule(:ocr_text) do
          key.failure("cannot be blank") if value.blank?
        end

        rule(:space_id) do
          key.failure("must be a valid space") unless Spaces::Space.exists?(id: value)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler

      def call(params:)
        params              = step validate(params:)
        space               = step find_space(params:)
        space_categories    = step fetch_space_categories(space:)
        ai_response         = step call_openai_api(params:, space_categories:)
        parsed_data         = step parse_ai_response(ai_response:)
        validated_data      = step validate_extracted_data(parsed_data:, space_categories:)
        final_result        = step prepare_extraction_result(validated_data:)
        final_result
      end

      private

      def find_space(params:)
        space = Spaces::Space.find(params[:space_id])
        Success(space)
      rescue ActiveRecord::RecordNotFound => e
        Failure(space_error: "Space not found", error: e)
      end

      def fetch_space_categories(space:)
        # Fetch expense categories for the space (already excludes UNINCLUDED_EXPENSE_CATEGORIES)
        categories = space.expense_categories.pluck(:name)

        # Fallback to default categories if space has no categories
        categories = Transactions::Category::DEFAULT_EXPENSE_CATEGORIES if categories.empty?

        Success(categories)
      rescue StandardError => e
        Failure(categories_error: "Failed to fetch categories", error: e)
      end

      def call_openai_api(params:, space_categories:)
        ocr_text = params[:ocr_text]

        system_prompt = build_system_prompt(space_categories)
        user_prompt = build_user_prompt(ocr_text)

        begin
          client = OpenAI::Client.new(
            access_token: ENV["OPENAI_API_KEY"] || Rails.application.credentials.openai_api_key
          )

          response = client.chat(
            parameters: {
              model: "gpt-3.5-turbo",
              messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: user_prompt }
              ],
              temperature: 0.1, # Low temperature for consistent extraction
              max_tokens: 200   # Keep response concise
            }
          )

          ai_content = response.dig("choices", 0, "message", "content")
          return Failure(ai_error: "No response from OpenAI") if ai_content.blank?

          Success(ai_content)
        rescue StandardError => e
          Failure(
            ai_error: "OpenAI API call failed",
            error: e
          )
        end
      end

      def build_system_prompt(space_categories)
        category_list = space_categories.join(", ")
        default_category = space_categories.first || "Family"

        <<~PROMPT
          You are a receipt data extraction expert. Extract the total amount, date, and suggest a category from receipt text.

          IMPORTANT RULES:
          1. Extract the FINAL TOTAL amount only (not subtotals, taxes, or line items)
          2. Extract the transaction DATE from the receipt text (look for date stamps, transaction dates, or receipt dates)
          3. Return ONLY valid JSON format
          4. For category, choose ONLY from: #{category_list}
          5. ALWAYS provide a category suggestion - if unclear, default to "#{default_category}"
          6. If no clear total found, return null for total_amount
          7. If no clear date found, return null for date

          AVAILABLE CATEGORIES: #{category_list}

          Choose the most appropriate category based on the merchant or transaction type:
          - Look for merchant names, store types, or transaction descriptions
          - Match them to the closest available category
          - If no clear match, use "#{default_category}" as default

          Response format (JSON only):
          {
            "total_amount": "XX.XX",
            "date": "YYYY-MM-DD",
            "category": "CategoryName",
            "confidence": "high|medium|low"
          }
        PROMPT
      end

      def build_user_prompt(ocr_text)
        "Extract total amount and category from this receipt text:\n\n#{ocr_text}"
      end

      def parse_ai_response(ai_response:)
        begin
          # Try to parse the JSON response
          parsed = JSON.parse(ai_response)

          # Validate expected structure
          unless parsed.is_a?(Hash)
            return Failure(parse_error: "AI response is not a valid JSON object")
          end

          Success(parsed)
        rescue JSON::ParserError => e
          # Try to extract JSON from text if it's wrapped in other content
          json_match = ai_response.match(/\{.*\}/m)
          if json_match
            begin
              parsed = JSON.parse(json_match[0])
              Success(parsed)
            rescue JSON::ParserError
              Failure(parse_error: "Could not parse JSON from AI response", raw_response: ai_response)
            end
          else
            Failure(parse_error: "No valid JSON found in AI response", raw_response: ai_response)
          end
        end
      end

      def validate_extracted_data(parsed_data:, space_categories:)
        return Success({}) if parsed_data.nil?
        validated = {}

        # Validate and clean total amount
        if parsed_data["total_amount"].present?
          amount = clean_amount(parsed_data["total_amount"])
          if amount && amount > 0 && amount < 50000 # Reasonable range
            validated[:total_amount] = {
              value: sprintf("%.2f", amount),
              confidence_score: confidence_to_score(parsed_data["confidence"])
            }
          end
        end

        # Validate and clean date
        if parsed_data["date"].present?
          date = clean_date(parsed_data["date"])
          if date
            validated[:date] = {
              value: date.strftime("%Y-%m-%d"),
              confidence_score: confidence_to_score(parsed_data["confidence"])
            }
          end
        end

        # Validate and clean category using space's categories - ALWAYS provide a category
        category = clean_category(parsed_data["category"], space_categories)
        validated[:category] = {
          value: category,
          confidence_score: confidence_to_score(parsed_data["confidence"])
        }

        Success(validated)
      end

      def clean_amount(amount_str)
        return nil if amount_str.blank? || amount_str == "null"

        # Preserve the sign
        is_negative = amount_str.to_s.strip.start_with?("-")

        # Remove currency symbols and non-numeric/non-decimal characters
        cleaned = amount_str.to_s.gsub(/[^\d.]/, "")
        return nil if cleaned.blank?

        amount = cleaned.to_f
        amount *= -1 if is_negative # Reapply the negative sign

        return nil if amount <= 0 # Return nil for zero or negative amounts

        amount
      end

      def clean_date(date_str)
        return nil if date_str.blank? || date_str == "null"

        # Try to parse various date formats
        begin
          date = Date.parse(date_str)
          return date
        rescue ArgumentError
          # If standard parsing fails, try specific formats
          if date_str.match?(/\d{4}-\d{2}-\d{2}/) # YYYY-MM-DD
            begin
              date = Date.strptime(date_str, "%Y-%m-%d")
              return date
            rescue ArgumentError
              return nil
            end
          elsif date_str.match?(/\d{2}-\d{2}-\d{4}/) # MM-DD-YYYY
            begin
              date = Date.strptime(date_str, "%m-%d-%Y")
              return date
            rescue ArgumentError
              return nil
            end
          elsif date_str.match?(/\d{2}-\d{2}-\d{2}/) # MM-DD-YY
            begin
              date = Date.strptime(date_str, "%m-%d-%y")
              return date
            rescue ArgumentError
              return nil
            end
          end
        end
        nil
      end

      def clean_category(category_str, space_categories)
        default_category = space_categories.first || "Family"
        return default_category if category_str.blank? || category_str == "null"

        # Validate against space's allowed categories
        category = category_str.to_s.strip

        # Check for exact match first
        return category if space_categories.include?(category)

        # Try case-insensitive match
        matched_category = space_categories.find { |cat| cat.downcase == category.downcase }
        return matched_category if matched_category

        # If no match found, return default
        default_category
      end

      def confidence_to_score(confidence_str)
        case confidence_str&.downcase
        when "high" then 0.85
        when "medium" then 0.65
        when "low" then 0.45
        else 0.60 # Default medium confidence
        end
      end

      def prepare_extraction_result(validated_data:)
        result = {
          extracted_fields: validated_data,
          suggested_category: validated_data.dig(:category, :value) || "Family"
        }

        Success(result)
      end
    end
  end
end
