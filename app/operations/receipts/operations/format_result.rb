# frozen_string_literal: true

module Receipts
  module Operations
    class FormatResult < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:receipt_data).value(:hash)
          required(:confidence_analysis).value(:hash)
          optional(:ocr_text).maybe(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler

      def call(params:)
        params                = step validate(params:)
        extracted_data        = step format_extracted_data(params:)
        confidence_summary    = step format_confidence_summary(params:)
        validation_flags      = step extract_validation_flags(params:)
        raw_data              = step prepare_raw_data(params:)
        suggested_payload     = step build_suggested_transaction_payload(extracted_data:)
        formatted_result      = step prepare_formatted_result(
                                    extracted_data:,
                                    confidence_summary:,
                                    validation_flags:,
                                    raw_data:,
                                    suggested_payload:
                                  )
        formatted_result
      end

      private

      def format_extracted_data(params:)
        receipt_data = params[:receipt_data]
        confidence_analysis = params[:confidence_analysis]

        # Add nil checks
        return Failure("Receipt data is missing") if receipt_data.nil?
        return Failure("Confidence analysis is missing") if confidence_analysis.nil?
        return Failure("Extracted fields are missing") if receipt_data[:extracted_fields].nil?
        return Failure("Field confidence data is missing") if confidence_analysis[:field_confidence].nil?

        extracted_data = {}

        # Format each field with its confidence information
        receipt_data[:extracted_fields].each do |field_name, field_data|
          confidence_info = confidence_analysis[:field_confidence][field_name.to_sym]

          extracted_data[field_name] = {
            value: field_data[:value],
            confidence_score: confidence_info&.dig(:enhanced_confidence), # Use safe navigation
            reliability: confidence_info&.dig(:reliability_level),
            needs_review: confidence_info&.dig(:needs_review),
            visual_indicators: confidence_info&.dig(:visual_indicators)
          }.compact # Remove nil values
        end

        # Add the suggested category if not already present AND if extracted_data does not already have a category
        if receipt_data[:suggested_category].present? && extracted_data[:category].nil?
          extracted_data[:category] = {
            value: receipt_data[:suggested_category],
            confidence_score: 0.8,
            reliability: :high,
            needs_review: false,
            visual_indicators: {
              color: "green",
              icon: "✓",
              css_class: "confidence-high"
            }
          }
        end

        Success(extracted_data)
      end

      def format_confidence_summary(params:)
        confidence_analysis = params[:confidence_analysis]

        summary = {
          overall_score: confidence_analysis[:overall_confidence],
          overall_level: confidence_analysis[:reliability_assessment][:overall_level],
          should_review: confidence_analysis[:confidence_metadata][:needs_review],
          total_fields_found: confidence_analysis[:confidence_metadata][:total_fields_analyzed],
          high_confidence_fields: confidence_analysis[:confidence_metadata][:high_confidence_fields],
          recommendations: confidence_analysis[:recommendations]
        }

        Success(summary)
      end

      def extract_validation_flags(params:)
        validation_flags = params[:confidence_analysis][:validation_flags]
        Success(validation_flags)
      end

      def prepare_raw_data(params:)
        # Keep minimal processing information
        raw_data = {
          processing_timestamp: Time.current
        }

        Success(raw_data)
      end

      def build_suggested_transaction_payload(extracted_data:)
        # Handle case where extracted_data might be nil
        return Success(default_transaction_payload) if extracted_data.nil?

        # Build the exact payload frontend should send if user doesn't change anything
        payload = {
          amount: extract_amount_value(extracted_data),
          date: extract_date_value(extracted_data),
          category_name: extract_category_value(extracted_data),
          account_name: extract_account_value(extracted_data),
          description: build_description(extracted_data),
          schedule_type: "one_time"
        }

        Success(payload)
      end

      def default_transaction_payload
        {
          amount: 0.0,
          date: Date.current.to_s,
          category_name: "Family",
          account_name: "Credit Card",
          description: "",
          schedule_type: "one_time"
        }
      end

      def extract_amount_value(extracted_data)
        return 0.0 if extracted_data.nil?
        amount_str = extracted_data.dig(:total_amount, :value) || "0.00"
        amount_str.to_f
      end

      def extract_date_value(extracted_data)
        return Date.current.to_s if extracted_data.nil?

        date_str = extracted_data.dig(:date, :value)
        if date_str.present?
          begin
            Date.parse(date_str).to_s
          rescue Date::Error
            Date.current.to_s
          end
        else
          Date.current.to_s
        end
      end

      def extract_category_value(extracted_data)
        return "Family" if extracted_data.nil?
        extracted_data.dig(:category, :value) || "Family"
      end

      def extract_account_value(extracted_data)
        return "Credit Card" if extracted_data.nil?
        extracted_data.dig(:account, :value) || "Credit Card"
      end

      def build_description(extracted_data)
        return "" if extracted_data.nil?

        merchant = extracted_data.dig(:merchant, :value)

        if merchant.present?
          "#{merchant}"
        else
          ""
        end
      end

      def prepare_formatted_result(extracted_data:, confidence_summary:, validation_flags:, raw_data:, suggested_payload:)
        result = {
          extracted_data: extracted_data,
          confidence_summary: confidence_summary,
          validation_flags: validation_flags,
          suggested_transaction_payload: suggested_payload,
          processing_timestamp: raw_data[:processing_timestamp]
        }

        Success(result)
      end
    end
  end
end
