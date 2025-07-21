# frozen_string_literal: true

module Receipts
  module Operations
    class CalculateConfidenceAi < Dry::Operation
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
        # Add proper nil checks
        return Failure("Receipt data is missing") if params[:receipt_data].nil?
        return Failure("Extracted fields are missing") if params[:receipt_data][:extracted_fields].nil?

        extracted_fields = params[:receipt_data][:extracted_fields]
        ocr_text = params[:ocr_text]

        field_scores = {}

        # Handle case where extracted_fields is empty
        if extracted_fields.empty?
          Rails.logger.warn "CalculateConfidenceAi: No extracted fields found"
          return Success({})
        end

        extracted_fields.each do |field_name, field_data|
          # Skip if field_data is nil
          next if field_data.nil?

          base_score = field_data[:confidence_score] || 0.6

          # For AI extraction, we trust the AI's confidence more
          enhanced_score = enhance_ai_confidence(field_name, field_data, ocr_text, base_score)

          field_scores[field_name] = {
            base_confidence: base_score,
            enhanced_confidence: enhanced_score,
            reliability_level: determine_reliability_level(enhanced_score),
            needs_review: enhanced_score < 0.7, # Higher threshold for AI
            visual_indicators: generate_visual_indicators(enhanced_score)
          }
        end

        Success(field_scores)
      end

      def enhance_ai_confidence(field_name, field_data, ocr_text, base_score)
        enhanced_score = base_score

        case field_name
        when :total_amount
          enhanced_score = enhance_ai_amount_confidence(field_data, enhanced_score)
        when :category
          enhanced_score = enhance_ai_category_confidence(field_data, enhanced_score)
        end

        # AI extraction gets a slight boost since it's more contextual
        enhanced_score += 0.05

        [enhanced_score, 1.0].min.round(3)
      end

      def enhance_ai_amount_confidence(field_data, score)
        amount = field_data[:value].to_f

        # Reasonable amount range
        score += 0.1 if amount.between?(1, 1000)
        score += 0.05 if amount.between?(0.50, 5000)
        score -= 0.2 if amount > 10000 || amount < 0.10

        # AI already validated format, so trust it
        score += 0.05

        score
      end

      def enhance_ai_category_confidence(field_data, score)
        category = field_data[:value]

        # Valid categories get confidence boost
        valid_categories = ["Family", "Gas", "Food", "Health", "Shopping"]
        score += 0.1 if valid_categories.include?(category)

        # AI categorization is generally reliable
        score += 0.1

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

        # For AI extraction, weight total_amount and category equally
        weights = {
          total_amount: 0.6,  # Most important
          category: 0.4       # Secondary but important
        }

        total_weight = 0
        weighted_sum = 0

        field_confidence.each do |field_name, confidence_data|
          weight = weights[field_name] || 0.0
          next if weight == 0

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
          field_consistency: :consistent, # AI is generally consistent
          processing_quality: assess_ai_processing_quality(field_confidence)
        }

        Success(assessment)
      end

      def has_critical_fields?(field_confidence)
        # For AI, we need at least total_amount OR category
        field_confidence.key?(:total_amount) || field_confidence.key?(:category)
      end

      def assess_ai_processing_quality(field_confidence)
        high_confidence_count = field_confidence.count do |_, data|
          data[:enhanced_confidence] >= 0.7
        end

        total_fields = field_confidence.size

        return :excellent if total_fields > 0 && high_confidence_count.to_f / total_fields >= 0.8
        return :good if total_fields > 0 && high_confidence_count.to_f / total_fields >= 0.5
        return :fair if total_fields > 0
        :poor
      end

      def generate_validation_flags(params:, field_confidence:)
        extracted_fields = params[:receipt_data][:extracted_fields]

        flags = {
          reasonable_amount: validate_reasonable_amount(extracted_fields),
          valid_category: validate_category_presence(extracted_fields),
          complete_data: validate_data_completeness(extracted_fields),
          high_confidence_extraction: validate_high_confidence(field_confidence),
          ai_processing_successful: true, # AI succeeded if we got here
          suggest_retry: should_suggest_retry?(field_confidence),
          recommend_manual_entry: should_recommend_manual?(field_confidence)
        }

        Success(flags)
      end

      def validate_reasonable_amount(fields)
        amount_field = fields[:total_amount]
        return false unless amount_field

        amount = amount_field[:value].to_f
        amount.between?(0.10, 50000)
      end

      def validate_category_presence(fields)
        fields.key?(:category) && fields[:category][:value].present?
      end

      def validate_data_completeness(fields)
        # For AI, having both fields is ideal
        fields.key?(:total_amount) && fields.key?(:category)
      end

      def validate_high_confidence(field_confidence)
        field_confidence.values.any? { |data| data[:enhanced_confidence] >= 0.7 }
      end

      def should_suggest_retry?(field_confidence)
        # Suggest retry if no field has reasonable confidence
        !field_confidence.values.any? { |data| data[:enhanced_confidence] >= 0.6 }
      end

      def should_recommend_manual?(field_confidence)
        # Recommend manual entry if AI confidence is very low across the board
        field_confidence.values.all? { |data| data[:enhanced_confidence] < 0.4 }
      end

      def generate_recommendations(field_confidence:, overall_confidence:, validation_flags:)
        recommendations = []

        recommendations << "AI extraction successful" if overall_confidence >= 0.7
        recommendations << "Consider retaking the photo" if validation_flags[:suggest_retry]
        recommendations << "Manual entry recommended" if validation_flags[:recommend_manual_entry]
        recommendations << "Review extracted amount" if !validation_flags[:reasonable_amount]
        recommendations << "Verify category suggestion" if !validation_flags[:valid_category]

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
            total_fields_analyzed: field_confidence.size,
            high_confidence_fields: field_confidence.count { |_, data| data[:enhanced_confidence] >= 0.7 },
            needs_review: overall_confidence < 0.7
          }
        }

        Success(result)
      end
    end
  end
end
