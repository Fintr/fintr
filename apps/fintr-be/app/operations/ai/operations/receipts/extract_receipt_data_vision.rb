# frozen_string_literal: true

module Ai
  module Operations
    module Receipts
      # Vision-based receipt extraction. Optimized for ~1s latency: resized image + low detail + concise output.
      class ExtractReceiptDataVision < Dry::Operation
        DEFAULT_MAX_VISION_EDGE = 768  # Receipt text stays readable; smaller = faster upload + inference
        DEFAULT_JPEG_QUALITY    = 82
        DEFAULT_IMAGE_DETAIL    = "low" # OpenAI-compatible; much faster than "high" for receipts
        DEFAULT_MAX_TOKENS      = 220
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
          space_merchants     = step fetch_space_merchants(space:)
          base64_image        = step encode_image_to_base64(params:)
          ai_response         = step call_openai_vision_api(
                                    base64_image:,
                                    space_categories:,
                                    space_accounts:,
                                    space_merchants:,
                                  )
          parsed_data         = step parse_ai_response(ai_response:)
          validated_data      = step validate_extracted_data(
                                    parsed_data:,
                                    space_categories:,
                                    space_accounts:,
                                    space_merchants:,
                                  )
          final_result        = step prepare_extraction_result(validated_data:)
          final_result
        end

        private

        def find_space(params:)
          space = Spaces::Space.find(params[:space_id])
          Success(space)
        rescue ActiveRecord::RecordNotFound => e
          Failure(space_error: "Space not found", error: e, expected: true)
        end

        def fetch_space_categories(space:)
          categories = Transactions::Category.expense
                           .where(space_id: space.id)
                           .roots
                           .includes(:children)
                           .order(:name)
                           .flat_map do |parent|
                             [parent.name] + parent.children.order(:name).pluck(:name)
                           end
                           .uniq

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

        def fetch_space_merchants(space:)
          entities = Entities::Entity
            .transactions
            .where(space_id: space.id)
            .includes(:merchant_aliases)
            .order(:full_name)

          catalog = entities.map do |entity|
            {
              name: entity.full_name,
              identifiers: merchant_identifier_labels(entity),
            }
          end

          Success(catalog)
        rescue StandardError => e
          Failure(merchants_error: "Failed to fetch merchants", error: e)
        end

        def merchant_identifier_labels(entity)
          entity.merchant_aliases
            .sort_by(&:created_at)
            .reverse
            .filter_map { |alias_record| alias_record.label.presence || alias_record.scanned_name }
        end

        def encode_image_to_base64(params:)
          image_path = params[:image_path]

          begin
            image_data, mime_type = resize_image_for_vision(image_path)
            base64_string = Base64.strict_encode64(image_data)
            formatted_image = "data:#{mime_type};base64,#{base64_string}"

            Success(formatted_image)
          rescue StandardError => e
            Failure(
              image_encoding_error: "Failed to encode image",
              error: e
            )
          end
        end

        # Resize and compress for fast vision API: smaller payload and fewer tokens.
        def resize_image_for_vision(image_path)
          img = MiniMagick::Image.open(image_path)
          img.resize "#{max_vision_edge}x#{max_vision_edge}>"
          img.format "jpeg"
          img.quality jpeg_quality.to_s
          [img.to_blob, "image/jpeg"]
        rescue StandardError
          # Fallback: original file (e.g. MiniMagick not available or invalid image)
          [File.binread(image_path), determine_mime_type(image_path)]
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

        def call_openai_vision_api(base64_image:, space_categories:, space_accounts:, space_merchants: [])
          system_prompt = build_vision_system_prompt(
            space_categories,
            space_accounts,
            space_merchants,
          )

          begin
            client = ::Ai::Llm::VisionClient.client
            model  = ::Ai::Llm::VisionClient.model

            response = client.chat(
              parameters: {
                model: model,
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
                        text: "Extract total, date, category, account, and the matching merchant from this receipt."
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: base64_image,
                          detail: vision_image_detail
                        }
                      }
                    ]
                  }
                ],
                temperature: 0.0,
                max_tokens: vision_max_tokens
              }.merge(::Ai::Llm::VisionClient.openrouter_chat_extras)
            )

            ai_content = response.dig("choices", 0, "message", "content")&.strip
            return Failure(ai_error: "No response from vision API") if ai_content.blank?

            Success(ai_content)
          rescue StandardError => e
            failure_message = vision_api_error_message(e)
            Failure(
              ai_vision_error: failure_message,
              error: e
            )
          end
        end

        def vision_api_error_message(exception)
          msg = exception.message.to_s
          return "Vision API payment required (402). Add credits or a payment method at https://openrouter.ai/credits" if msg.include?("402")
          return "Vision API authentication failed (401). Check OPENROUTER_API_KEY or OPENAI_API_KEY." if msg.include?("401")
          return "Vision API rate limit (429). Try again in a few moments." if msg.include?("429")

          "Vision API call failed"
        end

        def build_vision_system_prompt(space_categories, space_accounts, space_merchants = [])
          category_list = space_categories.join(", ")
          default_category = space_categories.first || "Family"
          account_list = space_accounts.join(", ")
          default_account = space_accounts.first || "Cash"
          merchant_rule = merchant_match_rule(space_merchants)

          <<~PROMPT.strip
            Receipt OCR. Reply with JSON only.
            - total_amount: final total (not subtotal); null if missing
            - date: YYYY-MM-DD or null. The date you see in the receipt.
            - category: exactly one of [#{category_list}]; default "#{default_category}". The category that the receipt is likely to be categorized under.
            - account: one of [#{account_list}]; default "#{default_account}". The account that the receipt is likely to be categorized under.
            - merchant_detected: store name printed on the receipt, or null.
            - merchant: #{merchant_rule}
            - confidence: high|medium|low
            Use merchant/service context (e.g. photo/cinema/wedding → photography, not dining).
            Match a merchant when the receipt text matches its name or an identifier in square brackets. Return the merchant name.
            {"total_amount":"..","date":"..","category":"..","account":"..","confidence":"..","merchant_detected":"..","merchant":".."}
          PROMPT
        end

        def merchant_match_rule(space_merchants)
          entries = merchant_entries(space_merchants)
          return "null" if entries.blank?

          formatted = entries.map { |entry| format_merchant_entry(entry) }
          "exactly one of [#{formatted.join(", ")}] when the receipt matches a known merchant name or identifier; return the merchant name; null if none match"
        end

        def merchant_entries(space_merchants)
          return [] if space_merchants.blank?

          space_merchants.map do |merchant|
            if merchant.is_a?(String)
              { name: merchant, identifiers: [] }
            else
              {
                name: merchant[:name] || merchant["name"],
                identifiers: Array(merchant[:identifiers] || merchant["identifiers"]),
              }
            end
          end
        end

        def format_merchant_entry(entry)
          identifiers = Array(entry[:identifiers]).filter_map do |identifier|
            identifier.to_s.gsub(/[\r\n]+/, " ").strip.presence
          end
          return entry[:name].to_s if identifiers.empty?

          "#{entry[:name]} [#{identifiers.join("; ")}]"
        end

        def max_vision_edge
          raw = ENV["AI_VISION_MAX_EDGE"].to_s.strip
          edge = raw.present? ? raw.to_i : DEFAULT_MAX_VISION_EDGE
          edge.positive? ? edge : DEFAULT_MAX_VISION_EDGE
        end

        def jpeg_quality
          raw = ENV["AI_VISION_JPEG_QUALITY"].to_s.strip
          quality = raw.present? ? raw.to_i : DEFAULT_JPEG_QUALITY
          quality.clamp(60, 95)
        end

        def vision_image_detail
          detail = ENV["AI_VISION_IMAGE_DETAIL"].to_s.strip.downcase
          return DEFAULT_IMAGE_DETAIL if detail.blank?

          %w[low high auto].include?(detail) ? detail : DEFAULT_IMAGE_DETAIL
        end

        def vision_max_tokens
          raw = ENV["AI_VISION_MAX_TOKENS"].to_s.strip
          tokens = raw.present? ? raw.to_i : DEFAULT_MAX_TOKENS
          tokens.positive? ? tokens : DEFAULT_MAX_TOKENS
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
          rescue JSON::ParserError
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

        def validate_extracted_data(parsed_data:, space_categories:, space_accounts:, space_merchants: [])
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

          matched_merchant = match_known_merchant(parsed_data["merchant"], space_merchants)
          matched_merchant ||= match_known_merchant(parsed_data["merchant_detected"], space_merchants)
          if matched_merchant
            validated[:entity] = {
              value: matched_merchant,
              confidence_score: vision_confidence_to_score(parsed_data["confidence"])
            }
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

        def match_known_merchant(merchant_str, space_merchants)
          return nil if merchant_str.blank? || merchant_str == "null"

          entries = merchant_entries(space_merchants)
          return nil if entries.blank?

          item = merchant_str.to_s.strip
          names = entries.filter_map { |entry| entry[:name].presence }
          return item if names.include?(item)

          matched_name = names.find { |name| name.casecmp?(item) }
          return matched_name if matched_name

          catalog_label = item.sub(/\s*\[[^\]]*\]\z/, "").strip
          if catalog_label != item
            matched_catalog_name = names.find { |name| name.casecmp?(catalog_label) }
            return matched_catalog_name if matched_catalog_name
          end

          normalized = normalized_merchant_text(item)
          return nil if normalized.blank?

          matched_entry = entries.find do |entry|
            Array(entry[:identifiers]).any? do |identifier|
              normalized_merchant_text(identifier) == normalized
            end
          end

          matched_entry&.dig(:name)
        end

        def normalized_merchant_text(value)
          Entities::MerchantAlias.normalize_name(value.to_s.gsub(/[\r\n]+/, " "))
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
            suggested_category: validated_data.dig(:category, :value) || "Family",
            suggested_account: validated_data.dig(:account, :value) || "Cash"
          }

          Success(result)
        end
      end
    end
  end
end
