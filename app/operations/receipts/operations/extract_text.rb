# frozen_string_literal: true

module Receipts
  module Operations
    class ExtractText < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:image_path).value(:string)
        end

        rule(:image_path) do
          key.failure("file does not exist") unless File.exist?(value)
          key.failure("must be an image file") unless image_file?(value)
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
        params      = step validate(params:)
        ocr_text    = step extract_text_with_tesseract(params:)
        cleaned_text = step clean_text(ocr_text:)
        metadata    = step generate_metadata(params:, cleaned_text:)
        result      = step prepare_result(cleaned_text:, metadata:)
        result
      end

      private

      def extract_text_with_tesseract(params:)
        # Using RTesseract gem for OCR processing
        image = RTesseract.new(
          params[:image_path],
          config_file: :digits, # Optimize for receipts with numbers
          psm: 6, # Assume a single uniform block of text
          oem: 3, # Use both legacy and LSTM engines
          lang: "eng"
        )

        text = image.to_s

        return Failure(ocr_error: "No text detected in image") if text.blank?

        Success(text)
      rescue StandardError => e
        Failure(
          ocr_error: "OCR processing failed",
          error: e
        )
      end

      def clean_text(ocr_text:)
        cleaned = ocr_text
          .gsub(/[^\w\s\$\.\-\/:@]/, " ") # Keep only alphanumeric, currency, and common receipt symbols
          .gsub(/\s+/, " ") # Normalize whitespace
          .strip

        Success(cleaned)
      end

      def generate_metadata(params:, cleaned_text:)
        metadata = {
          original_image_path: params[:image_path],
          character_count: cleaned_text.length,
          word_count: cleaned_text.split.length,
          line_count: cleaned_text.lines.count,
          extraction_timestamp: Time.current,
          ocr_engine: "tesseract",
          confidence_indicators: {
            has_currency_symbols: cleaned_text.include?("$"),
            has_numbers: cleaned_text.match?(/\d/),
            has_dates: date_patterns_found?(cleaned_text),
            reasonable_length: cleaned_text.length.between?(20, 2000)
          }
        }

        Success(metadata)
      end

      def date_patterns_found?(text)
        date_patterns = [
          /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
          /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
          /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
        ]

        date_patterns.any? { |pattern| text.match?(pattern) }
      end

      def prepare_result(cleaned_text:, metadata:)
        result = {
          text: cleaned_text,
          metadata: metadata,
          quality_score: calculate_quality_score(cleaned_text:, metadata:)
        }

        Success(result)
      end

      def calculate_quality_score(cleaned_text:, metadata:)
        score = 0.5 # Base score

        # Boost score based on content indicators
        score += 0.1 if metadata[:confidence_indicators][:has_currency_symbols]
        score += 0.1 if metadata[:confidence_indicators][:has_numbers]
        score += 0.1 if metadata[:confidence_indicators][:has_dates]
        score += 0.1 if metadata[:confidence_indicators][:reasonable_length]
        score += 0.1 if metadata[:word_count] > 5

        # Penalize very short or very long text
        score -= 0.2 if metadata[:character_count] < 10
        score -= 0.1 if metadata[:character_count] > 1500

        [score, 1.0].min.round(2)
      end
    end
  end
end
