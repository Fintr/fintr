# frozen_string_literal: true

module Receipts
  module Operations
    class ExtractReceiptData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:ocr_text).value(:string)
        end

        rule(:ocr_text) do
          key.failure("cannot be blank") if value.blank?
        end
      end

      def validate(params:)
        contract = Contract.new.call(params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler

      # Pattern definitions for receipt extraction
      PATTERNS = {
        total_amount: [
          /total[:\s]*\$?(\d+\.?\d*)/i,
          /amount[:\s]*\$?(\d+\.?\d*)/i,
          /subtotal[:\s]*\$?(\d+\.?\d*)/i,
          /\$(\d+\.\d{2})\s*(?:total|amount|subtotal)/i,
          /(?:total|amount|subtotal)\s*\$?(\d+\.\d{2})/i,
          /(\d+\.\d{2})\s*(?:total|amount)/i
        ],

        date: [
          /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
          /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
          /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i,
          /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i
        ],

        merchant: [
          /^([A-Z\s&'.-]+)(?:\s+#\d+)?\s*$/m, # First meaningful line often merchant
          /store[:\s]*([a-z\s&'.-]+)/i,
          /merchant[:\s]*([a-z\s&'.-]+)/i,
          /([A-Z][A-Z\s&'.-]{2,})\s+(?:store|market|shop|restaurant|cafe)/i
        ],

        store_number: [
          /store[:\s#]*(\d+)/i,
          /#(\d+)/,
          /location[:\s]*(\d+)/i,
          /branch[:\s]*(\d+)/i
        ],

        tax_amount: [
          /tax[:\s]*\$?(\d+\.?\d*)/i,
          /vat[:\s]*\$?(\d+\.?\d*)/i,
          /\$(\d+\.\d{2})\s*(?:tax|vat)/i
        ],

        phone_number: [
          /(\(\d{3}\)\s*\d{3}-\d{4})/,
          /(\d{3}-\d{3}-\d{4})/,
          /(\d{10})/
        ]
      }.freeze

      def call(params:)
        params              = step validate(params:)
        extracted_fields    = step extract_all_fields(params:)
        validated_fields    = step validate_extracted_fields(extracted_fields:)
        processed_fields    = step process_field_values(validated_fields:)
        suggested_category  = step suggest_category(processed_fields:)
        final_result        = step prepare_extraction_result(
                                    processed_fields:,
                                    suggested_category:
                                  )
        final_result
      end

      private

      def extract_all_fields(params:)
        ocr_text = params[:ocr_text]
        results = {}

        PATTERNS.each do |field, patterns|
          matches = []
          patterns.each_with_index do |pattern, index|
            if match = ocr_text.match(pattern)
              matches << {
                value: match[1]&.strip,
                pattern_index: index,
                pattern: pattern.source,
                position: match.begin(0).to_f / ocr_text.length,
                confidence_factors: analyze_match_context(match, field, ocr_text)
              }
            end
          end

          results[field] = select_best_match(matches, field) if matches.any?
        end

        Success(results)
      end

      def analyze_match_context(match, field, text)
        context_before = text[0...match.begin(0)]
        context_after = text[match.end(0)..-1]

        {
          near_beginning: match.begin(0) < text.length * 0.2,
          near_end: match.end(0) > text.length * 0.8,
          has_currency_nearby: (match[0] + context_before + context_after)[0..50].include?("$"),
          line_position: context_before.count("\n"),
          surrounded_by_numbers: context_nearby_has_numbers?(context_before, context_after)
        }
      end

      def context_nearby_has_numbers?(before, after)
        nearby_text = (before.chars.last(20).join || "") + (after.chars.first(20).join || "")
        nearby_text.match?(/\d/)
      end

      def select_best_match(matches, field)
        # Score each match based on multiple factors
        scored_matches = matches.map do |match|
          score = calculate_match_score(match, field)
          match.merge(score: score)
        end
        # Return the highest scoring match
        scored_matches.max_by { |match| match[:score] }
      end

      def calculate_match_score(match, field)
        base_score = 0.5
        factors = match[:confidence_factors]

        case field
        when :total_amount
          base_score += 0.2 if factors[:near_end] # Totals usually at bottom
          base_score += 0.1 if factors[:has_currency_nearby]
          base_score += 0.1 if factors[:surrounded_by_numbers]
        when :merchant
          base_score += 0.2 if factors[:near_beginning] # Merchant usually at top
          base_score += 0.1 if match[:value]&.split&.size.to_i >= 2 # Multi-word names
        when :date
          base_score += 0.1 if factors[:near_beginning] || factors[:near_end]
        end

        # Pattern priority bonus (earlier patterns are typically better)
        base_score += (0.1 * (5 - match[:pattern_index])) / 5.0

        [base_score, 1.0].min.round(3)
      end

      def validate_extracted_fields(extracted_fields:)
        validated = {}

        extracted_fields.each do |field, match|
          case field
          when :total_amount
            validated[field] = validate_amount(match)
          when :date
            validated[field] = validate_date(match)
          when :merchant
            validated[field] = validate_merchant(match)
          else
            validated[field] = match # Pass through other fields
          end
        end

        Success(validated.compact)
      end

      def validate_amount(match)
        return nil unless match && match[:value]

        amount = clean_amount(match[:value])
        return nil if amount.nil? || amount > 50000 # Reasonable receipt range

        match.merge(
          validated_value: amount,
          formatted_value: sprintf("%.2f", amount)
        )
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

      def validate_date(match)
        return nil unless match && match[:value]

        begin
          parsed_date = Date.parse(match[:value])
          # Reasonable date range (not too far in past/future)
          # Use Date.current for consistent testing of date range
          current_date = Date.current
          return nil if parsed_date < 2.years.ago(current_date) || parsed_date > 1.week.from_now(current_date)

          match.merge(
            validated_value: parsed_date,
            formatted_value: parsed_date.strftime("%Y-%m-%d")
          )
        rescue Date::Error
          nil
        end
      end

      def validate_merchant(match)
        return nil unless match && match[:value]

        merchant = match[:value].strip.titleize
        return nil if merchant.length < 2 || merchant.length > 50

        match.merge(
          validated_value: merchant,
          formatted_value: merchant
        )
      end

      def process_field_values(validated_fields:)
        processed = {}

        validated_fields.each do |field, match|
          processed[field] = {
            value: match[:formatted_value] || match[:value],
            confidence_score: match[:score],
            pattern_used: match[:pattern],
            extraction_method: "pattern_#{field}"
          }
        end

        Success(processed)
      end

      def suggest_category(processed_fields:)
        merchant = processed_fields.dig(:merchant, :value)

        suggested_category = if merchant.present?
          categorize_by_merchant(merchant)
        else
          "Family" # Default category as requested
        end

        Success(suggested_category)
      end

      def categorize_by_merchant(merchant_name)
        merchant_lower = merchant_name.downcase

        case merchant_lower
        when /grocery|market|food|super|walmart|target|costco/
          "Family" # As requested for groceries
        when /gas|shell|exxon|bp|chevron|fuel/
          "Gas"
        when /restaurant|cafe|coffee|mcdonald|burger|pizza|starbucks/
          "Food"
        when /pharmacy|cvs|walgreens|drug/
          "Health"
        when /clothing|fashion|department|mall/
          "Shopping"
        else
          "Family" # Default fallback
        end
      end

      def prepare_extraction_result(processed_fields:, suggested_category:)
        result = {
          extracted_fields: processed_fields,
          suggested_category: suggested_category,
          extraction_metadata: {
            total_fields_found: processed_fields.keys.size,
            has_essential_data: has_essential_data?(processed_fields),
            extraction_timestamp: Time.current,
            processing_method: "tesseract_pattern_matching"
          }
        }

        Success(result)
      end

      def has_essential_data?(fields)
        # Essential data: at least merchant OR amount
        fields.key?(:merchant) || fields.key?(:total_amount)
      end
    end
  end
end
