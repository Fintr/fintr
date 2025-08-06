# frozen_string_literal: true

module Receipts
  module Operations
    class ExtractReceiptDataVision < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:image_path).value(:string)
          required(:space_id).value(:string)
        end

        rule(:image_path) do
          key.failure("file does not exist") unless File.exist?(value)
          key.failure("must be an image file") unless image_file?(value)
        end

        rule(:space_id) do
          key.failure("must be a valid space") unless Spaces::Space.exists?(id: value)
        end

        def image_file?(path)
          allowed_extensions = %w[.jpg .jpeg .png .bmp .tiff .tif]
          allowed_extensions.include?(File.extname(path).downcase)
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
        space_accounts      = step fetch_space_accounts(space:)
        base64_image        = step encode_image_to_base64(params:)
        ai_response         = step call_openai_vision_api(base64_image:, space_categories:, space_accounts:)
        parsed_data         = step parse_ai_response(ai_response:)
        validated_data      = step validate_extracted_data(parsed_data:, space_categories:, space_accounts:)
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

      def fetch_space_accounts(space:)
        accounts = space.accounts.pluck(:name)

        # Fallback to default categories if space has no categories
        accounts = Transactions::Account::ACCOUNT_CATEGORY_LABELS.values if accounts.empty?

        Success(accounts)
      rescue StandardError => e
        Failure(accounts_error: "Failed to fetch accounts", error: e)
      end

      def encode_image_to_base64(params:)
        image_path = params[:image_path]

        begin
          # Read the image file and encode it to base64
          image_data = File.binread(image_path)
          mime_type = determine_mime_type(image_path)
          base64_string = Base64.strict_encode64(image_data)

          # Format for OpenAI API
          formatted_image = "data:#{mime_type};base64,#{base64_string}"

          Success(formatted_image)
        rescue StandardError => e
          Failure(
            image_encoding_error: "Failed to encode image",
            error: e
          )
        end
      end

      def determine_mime_type(image_path)
        extension = File.extname(image_path).downcase
        case extension
        when ".jpg", ".jpeg" then "image/jpeg"
        when ".png" then "image/png"
        when ".bmp" then "image/bmp"
        when ".tiff", ".tif" then "image/tiff"
        else "image/jpeg" # Default fallback
        end
      end

      def call_openai_vision_api(base64_image:, space_categories:, space_accounts:)
        system_prompt = build_vision_system_prompt(space_categories, space_accounts)

        begin
          client = OpenAI::Client.new(
            access_token: ENV["OPENAI_API_KEY"] || Rails.application.credentials.openai_api_key
          )

          response = client.chat(
            parameters: {
              model: "gpt-4o", # GPT-4 with vision capabilities
              messages: [
                {
                  role: "system",
                  content: system_prompt
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Please analyze this receipt image and extract the total amount, date, and appropriate category."
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: base64_image,
                        detail: "high" # High detail for better text recognition
                      }
                    }
                  ]
                }
              ],
              temperature: 0.1, # Low temperature for consistent extraction
              max_tokens: 300   # Keep response concise
            }
          )

          ai_content = response.dig("choices", 0, "message", "content")&.strip
          return Failure(ai_error: "No response from OpenAI Vision") if ai_content.blank?

          Success(ai_content)
        rescue StandardError => e
          Failure(
            ai_vision_error: "OpenAI Vision API call failed",
            error: e
          )
        end
      end

      def build_vision_system_prompt(space_categories, space_accounts)
        category_list = space_categories.join(", ")
        default_category = space_categories.first || "Family"
        account_list = space_accounts.join(", ")
        default_account = space_accounts.first || "Cash"

        <<~PROMPT
          You are an expert receipt analyzer with computer vision capabilities. Analyze receipt images and extract the total amount, date, and suggest the most appropriate category.

          IMPORTANT RULES:
          1. Look at the receipt image carefully and identify the FINAL TOTAL amount (not subtotals, taxes, or individual line items)
          2. Extract the transaction DATE from the receipt (look for date stamps, transaction dates, or receipt dates)
          3. Return ONLY valid JSON format
          4. For category, choose ONLY from: #{category_list}
          5. ALWAYS provide a category suggestion - if unclear, default to "#{default_category}"
          6. For account, choose ONLY from: #{account_list}
          7. If no clear account found, default to "#{default_account}"
          6. If no clear total found, return null for total_amount
          7. If no clear date found, return null for date
          8. Use visual context clues like merchant logos, store names, or item types visible in the image

          AVAILABLE CATEGORIES: #{category_list}
          AVAILABLE ACCOUNTS: #{account_list}

          VISUAL ANALYSIS GUIDELINES:
          - Look for merchant names/logos at the top of the receipt
          - Identify the final total line (usually at the bottom, may be bold or emphasized)
          - Look for date information (usually near the top or bottom, may be in various formats)
          - Consider the types of items purchased if visible
          - Use store branding and visual context to determine appropriate category
          - Pay attention to currency symbols and decimal formatting

          Response format (JSON only):
          {
            "total_amount": "XX.XX",
            "date": "YYYY-MM-DD",
            "category": "CategoryName",
            "account": "AccountName",
            "confidence": "high|medium|low",
            "merchant_detected": "Store Name (if visible)"
          }
        PROMPT
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

      def validate_extracted_data(parsed_data:, space_categories:, space_accounts:)
        # Add nil check for parsed_data
        return Failure("Parsed data is missing") if parsed_data.nil?

        validated = {}

        # Validate and clean total amount
        if parsed_data["total_amount"].present?
          amount = clean_amount(parsed_data["total_amount"])
          if amount && amount > 0 && amount < 50000 # Reasonable range
            validated[:total_amount] = {
              value: sprintf("%.2f", amount),
              confidence_score: vision_confidence_to_score(parsed_data["confidence"])
            }
          end
        end

        # Validate and clean date
        if parsed_data["date"].present?
          date = clean_date(parsed_data["date"])
          if date
            validated[:date] = {
              value: date.strftime("%Y-%m-%d"),
              confidence_score: vision_confidence_to_score(parsed_data["confidence"])
            }
          end
        end

        # Validate and clean category using space's categories - ALWAYS provide a category
        category = clean_item(parsed_data["category"], space_categories)
        # We use snake-cased values for accounts in frontend
        account = clean_item(parsed_data["account"], space_accounts)
        validated[:category] = {
          value: category,
          confidence_score: vision_confidence_to_score(parsed_data["confidence"])
        }
        validated[:account] = {
          value: account,
          confidence_score: vision_confidence_to_score(parsed_data["confidence"])
        }

        # Add merchant info if detected
        if parsed_data["merchant_detected"].present?
          merchant = clean_merchant(parsed_data["merchant_detected"])
          if merchant
            validated[:merchant] = {
              value: merchant,
              confidence_score: vision_confidence_to_score(parsed_data["confidence"])
            }
          end
        end

        Success(validated)
      end

      def clean_amount(amount_str)
        return nil if amount_str.blank? || amount_str == "null"

        # Remove currency symbols and clean up
        cleaned = amount_str.to_s.gsub(/[^\d.]/, "")
        return nil if cleaned.blank?

        amount = cleaned.to_f
        amount > 0 ? amount : nil
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

      def clean_merchant(merchant_str)
        return nil if merchant_str.blank? || merchant_str == "null"

        # Clean up and return the merchant name
        merchant_str.to_s.strip
      end

      def clean_item(item_str, item_list)
        default_item = item_list.first
        return default_item if item_str.blank? || item_str == "null"

        # Validate against item's allowed list
        item = item_str.to_s.strip

        # Check for exact match first
        return item if item_list.include?(item)

        # Try case-insensitive match
        matched_item = item_list.find { |cat| cat.downcase == item.downcase }
        return matched_item if matched_item

        # If no match found, return default
        default_item
      end

      def vision_confidence_to_score(confidence_str)
        case confidence_str&.downcase
        when "high" then 0.90    # Vision is typically more confident
        when "medium" then 0.75  # Higher baseline than OCR
        when "low" then 0.55     # Even low vision confidence is decent
        else 0.80                # Default high confidence for vision
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
