# frozen_string_literal: true

module Receipts
  module Operations
    class CalculateConfidence < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:receipt_data).value(:hash)
          required(:ocr_text).value(:string)
        end

        rule(:receipt_data) do
          key.failure("must contain extracted_fields") unless value.key?(:extracted_fields)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler

      def call(params:)
        params                  = step validate(params:)
        field_confidence        = step calculate_field_confidence(params:)
        overall_confidence      = step calculate_overall_confidence(field_confidence:)
        reliability_assessment  = step assess_reliability(field_confidence:, overall_confidence:)
        validation_flags        = step generate_validation_flags(params:, field_confidence:)
        recommendations         = step generate_recommendations(
                                        field_confidence:,
                                        overall_confidence:,
                                        validation_flags:
                                      )
        confidence_result       = step prepare_confidence_result(
                                        field_confidence:,
                                        overall_confidence:,
                                        reliability_assessment:,
                                        validation_flags:,
                                        recommendations:
                                      )
        confidence_result
      end

      private

      def calculate_field_confidence(params:)
        extracted_fields = params[:receipt_data][:extracted_fields]
        ocr_text = params[:ocr_text]

        field_scores = {}

        extracted_fields.each do |field_name, field_data|
          base_score = field_data[:confidence_score] || 0.5

          # Enhance confidence based on field-specific factors
          enhanced_score = enhance_field_confidence(
            field_name,
            field_data,
            ocr_text,
            base_score
          )

          field_scores[field_name] = {
            base_confidence: base_score,
            enhanced_confidence: enhanced_score,
            reliability_level: determine_reliability_level(enhanced_score),
            needs_review: enhanced_score < 0.6,
            visual_indicators: generate_visual_indicators(enhanced_score)
          }
        end

        Success(field_scores)
      end

      def enhance_field_confidence(field_name, field_data, ocr_text, base_score)
        enhanced_score = base_score

        case field_name
        when :total_amount
          enhanced_score = enhance_amount_confidence(field_data, ocr_text, enhanced_score)
        when :date
          enhanced_score = enhance_date_confidence(field_data, enhanced_score)
        when :merchant
          enhanced_score = enhance_merchant_confidence(field_data, ocr_text, enhanced_score)
        end

        # Apply general enhancements
        enhanced_score = apply_general_enhancements(field_data, enhanced_score)

        [enhanced_score, 1.0].min.round(3)
      end

      def enhance_amount_confidence(field_data, ocr_text, score)
        amount = field_data[:value].to_f

        # Reasonable amount range
        score += 0.1 if amount.between?(1, 1000)
        score -= 0.2 if amount > 5000 || amount < 0.50

        # Proper decimal format
        score += 0.1 if field_data[:value].match?(/\d+\.\d{2}$/)

        # Context validation
        score += 0.1 if ocr_text.downcase.include?("total")

        score
      end

      def enhance_date_confidence(field_data, score)
        return score unless field_data[:value]

        begin
          date = Date.parse(field_data[:value])

          # Recent date is more likely
          days_ago = (Date.current - date).to_i
          score += 0.1 if days_ago.between?(0, 30)
          score += 0.05 if days_ago.between?(31, 90)
          score -= 0.1 if days_ago > 365

          # Weekend purchases are common for receipts
          score += 0.05 if [0, 6].include?(date.wday) # Saturday or Sunday

          score
        rescue Date::Error
          score - 0.3 # Heavily penalize invalid dates
        end
      end

      def enhance_merchant_confidence(field_data, ocr_text, score)
        merchant = field_data[:value]

        # Multi-word merchant names are more credible
        word_count = merchant.split.size
        score += 0.1 if word_count >= 2
        score += 0.05 if word_count >= 3

        # Common merchant patterns
        score += 0.1 if merchant.match?(/\b(store|market|shop|restaurant|cafe|inc|llc)\b/i)

        # Proper capitalization suggests better OCR quality
        score += 0.05 if merchant.match?(/^[A-Z]/) && merchant.match?(/[a-z]/)

        # Length validation
        score -= 0.1 if merchant.length < 3 || merchant.length > 40

        score
      end

      def apply_general_enhancements(field_data, score)
        # Boost confidence if pattern was highly specific
        if field_data[:pattern_used]&.include?("total") ||
           field_data[:pattern_used]&.include?("date")
          score += 0.05
        end

        score
      end

      def determine_reliability_level(confidence_score)
        case confidence_score
        when 0.8..1.0 then :high
        when 0.6..0.8 then :medium
        when 0.4..0.6 then :low
        else :very_low
        end
      end

      def generate_visual_indicators(confidence_score)
        {
          color: confidence_color(confidence_score),
          icon: confidence_icon(confidence_score),
          css_class: "confidence-#{determine_reliability_level(confidence_score)}"
        }
      end

      def confidence_color(score)
        case score
        when 0.8..1.0 then "green"
        when 0.6..0.8 then "yellow"
        when 0.4..0.6 then "orange"
        else "red"
        end
      end

      def confidence_icon(score)
        case score
        when 0.8..1.0 then "✓"
        when 0.6..0.8 then "?"
        when 0.4..0.6 then "⚠"
        else "✗"
        end
      end

      def calculate_overall_confidence(field_confidence:)
        return Success(0.0) if field_confidence.empty?

        # Weighted confidence calculation
        weights = {
          total_amount: 0.4,  # Most important
          merchant: 0.3,      # Very important
          date: 0.2,          # Moderately important
          store_number: 0.05,
          tax_amount: 0.05
        }

        total_weight = 0
        weighted_sum = 0

        field_confidence.each do |field_name, confidence_data|
          weight = weights[field_name] || 0.1
          total_weight += weight
          weighted_sum += confidence_data[:enhanced_confidence] * weight
        end

        overall_score = total_weight > 0 ? weighted_sum / total_weight : 0.0

        Success(overall_score.round(3))
      end

      def assess_reliability(field_confidence:, overall_confidence:)
        assessment = {
          overall_level: determine_reliability_level(overall_confidence),
          critical_fields_present: has_critical_fields?(field_confidence),
          field_consistency: check_field_consistency(field_confidence),
          processing_quality: assess_processing_quality(field_confidence)
        }

        Success(assessment)
      end

      def has_critical_fields?(field_confidence)
        # At least one critical field should be present with decent confidence
        critical_fields = [:total_amount, :merchant]

        critical_fields.any? do |field|
          field_confidence[field] &&
          field_confidence[field][:enhanced_confidence] >= 0.5
        end
      end

      def check_field_consistency(field_confidence)
        # Check if multiple fields have similar confidence levels
        confidences = field_confidence.values.map { |f| f[:enhanced_confidence] }
        return :consistent if confidences.empty?

        std_dev = calculate_standard_deviation(confidences)

        case std_dev
        when 0..0.15 then :very_consistent
        when 0.16..0.25 then :consistent
        when 0.26..0.35 then :somewhat_consistent
        else :inconsistent
        end
      end

      def calculate_standard_deviation(values)
        return 0.0 if values.size <= 1

        mean = values.sum.to_f / values.size
        variance = values.sum { |v| (v - mean) ** 2 } / values.size
        Math.sqrt(variance)
      end

      def assess_processing_quality(field_confidence)
        high_confidence_count = field_confidence.count do |_, data|
          data[:enhanced_confidence] >= 0.8
        end

        total_fields = field_confidence.size

        return :excellent if total_fields > 0 && high_confidence_count.to_f / total_fields >= 0.8
        return :good if total_fields > 0 && high_confidence_count.to_f / total_fields >= 0.6
        return :fair if total_fields > 0 && high_confidence_count.to_f / total_fields >= 0.4
        :poor
      end

      def generate_validation_flags(params:, field_confidence:)
        extracted_fields = params[:receipt_data][:extracted_fields]

        flags = {
          reasonable_amount: validate_reasonable_amount(extracted_fields),
          valid_date: validate_date_presence(extracted_fields),
          known_merchant: validate_merchant_presence(extracted_fields),
          complete_data: validate_data_completeness(extracted_fields),
          high_confidence_extraction: validate_high_confidence(field_confidence),
          ocr_quality: assess_ocr_quality(params[:ocr_text]),
          suggest_retry: should_suggest_retry?(field_confidence),
          recommend_manual_entry: should_recommend_manual?(field_confidence)
        }

        Success(flags)
      end

      def validate_reasonable_amount(fields)
        amount_field = fields[:total_amount]
        return false unless amount_field

        amount = amount_field[:value].to_f
        amount.between?(0.50, 10000)
      end

      def validate_date_presence(fields)
        fields.key?(:date) && fields[:date][:value].present?
      end

      def validate_merchant_presence(fields)
        fields.key?(:merchant) && fields[:merchant][:value].present?
      end

      def validate_data_completeness(fields)
        # At least 2 out of 3 critical fields
        critical_fields = [:total_amount, :merchant, :date]
        present_count = critical_fields.count { |field| fields[field]&.dig(:value).present? }
        present_count >= 2
      end

      def validate_high_confidence(field_confidence)
        field_confidence.values.any? { |data| data[:enhanced_confidence] >= 0.8 }
      end

      def assess_ocr_quality(ocr_text)
        word_count = ocr_text.split.size
        char_count = ocr_text.length

        return :poor if word_count < 5 || char_count < 20
        return :fair if word_count < 15 || char_count < 50
        return :good if word_count < 30 || char_count < 200
        :excellent
      end

      def should_suggest_retry?(field_confidence)
        # Suggest retry if no field has high confidence
        !field_confidence.values.any? { |data| data[:enhanced_confidence] >= 0.7 }
      end

      def should_recommend_manual?(field_confidence)
        # Recommend manual entry if overall quality is very poor
        field_confidence.values.all? { |data| data[:enhanced_confidence] < 0.5 }
      end

      def generate_recommendations(field_confidence:, overall_confidence:, validation_flags:)
        recommendations = []

        recommendations << "Consider retaking the photo" if validation_flags[:suggest_retry]
        recommendations << "Manual entry recommended" if validation_flags[:recommend_manual_entry]
        recommendations << "Review extracted amount" if !validation_flags[:reasonable_amount]
        recommendations << "Verify merchant name" if !validation_flags[:known_merchant]
        recommendations << "Check date accuracy" if !validation_flags[:valid_date]

        if overall_confidence >= 0.8
          recommendations << "Data looks accurate, safe to proceed"
        elsif overall_confidence >= 0.6
          recommendations << "Review highlighted fields before proceeding"
        else
          recommendations << "Consider manual verification of all fields"
        end

        Success(recommendations)
      end

      def prepare_confidence_result(field_confidence:, overall_confidence:, reliability_assessment:, validation_flags:, recommendations:)
        result = {
          field_confidence: field_confidence,
          overall_confidence: overall_confidence,
          reliability_assessment: reliability_assessment,
          validation_flags: validation_flags,
          recommendations: recommendations,
          confidence_metadata: {
            calculation_timestamp: Time.current,
            total_fields_analyzed: field_confidence.size,
            high_confidence_fields: field_confidence.count { |_, data| data[:enhanced_confidence] >= 0.8 },
            needs_review: overall_confidence < 0.6
          }
        }

        Success(result)
      end
    end
  end
end
