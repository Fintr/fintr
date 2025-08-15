# frozen_string_literal: true

module Receipts
  module Operations
    class CreateTransactionFromReceipt < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)
          required(:receipt_data).value(:hash)
        end

        rule(:receipt_data) do
          key.failure("must contain merchant or total_amount") unless contains_essential_data?(value)
        end

        def contains_essential_data?(data)
          data.key?(:merchant) || data.key?(:total_amount)
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
        transaction_params    = step build_transaction_params(params:)
        validated_params      = step validate_transaction_params(transaction_params:)
        transaction           = step create_transaction(validated_params:)
        transaction
      end

      private

      def build_transaction_params(params:)
        receipt_data = params[:receipt_data]

        # Extract values from receipt data
        amount = extract_amount(receipt_data)
        date = extract_date(receipt_data)
        category_name = extract_category(receipt_data)
        description = build_description(receipt_data)
        account_name = determine_account_name(receipt_data)

        transaction_params = {
          user_id: params[:user_id],
          space_id: params[:space_id],
          amount: amount,
          date: date,
          category_name: category_name,
          account_name: account_name,
          description: description,
          schedule_type: "one_time" # Receipts are always one-time transactions
        }

        Success(transaction_params)
      end

      def extract_amount(receipt_data)
        amount_data = receipt_data[:total_amount]
        return 0.0 unless amount_data && amount_data[:value]

        amount_value = amount_data[:value]

        # Handle both string and numeric values
        case amount_value
        when String
          amount_value.gsub(/[^\d.]/, "").to_f
        when Numeric
          amount_value.to_f
        else
          0.0
        end
      end

      def extract_date(receipt_data)
        date_data = receipt_data[:date]

        if date_data && date_data[:value]
          begin
            Date.parse(date_data[:value])
          rescue Date::Error
            Date.current
          end
        else
          Date.current
        end
      end

      def extract_category(receipt_data)
        category_data = receipt_data[:category]

        if category_data && category_data[:value].present?
          category_data[:value]
        else
          "Family" # Default fallback category
        end
      end

      def build_description(receipt_data)
        parts = []

        # Add merchant name if available
        if receipt_data[:merchant] && receipt_data[:merchant][:value].present?
          parts << "Receipt from #{receipt_data[:merchant][:value]}"
        else
          parts << "Receipt transaction"
        end

        # Add confidence indicator
        if receipt_data[:total_amount] && receipt_data[:total_amount][:confidence_score]
          confidence = (receipt_data[:total_amount][:confidence_score] * 100).round(0)
          parts << "(#{confidence}% confidence)"
        end

        # Add processing method
        parts << "[Auto-processed from receipt]"

        parts.join(" ")
      end

      def determine_account_name(receipt_data)
        # For now, default to a common account name
        # This could be enhanced to use merchant categorization
        merchant = receipt_data.dig(:merchant, :value)

        case merchant&.downcase
        when /gas|fuel|station/
          "Credit Card"
        when /grocery|market|food/
          "Debit Card"
        when /restaurant|cafe|coffee/
          "Cash"
        else
          "Credit Card" # Most common default for receipts
        end
      end

      def validate_transaction_params(transaction_params:)
        # Use the existing transaction creation contract to validate
        contract = Transactions::Operations::CreateTransaction::Contract.new.call(**transaction_params)

        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def create_transaction(validated_params:)
        # Use the existing transaction creation operation
        result = Transactions::Operations::CreateTransaction.new.call(validated_params)

        if result.success?
          transaction = result.value!
          Success(transaction)
        else
          # Transform the failure to include receipt context
          failure_data = result.failure
          enhanced_failure = failure_data.merge(
            context: "receipt_transaction_creation",
            original_receipt_data: validated_params
          )
          Failure(enhanced_failure)
        end
      end
    end
  end
end
