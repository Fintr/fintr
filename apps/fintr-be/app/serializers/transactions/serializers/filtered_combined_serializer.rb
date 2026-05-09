# frozen_string_literal: true

module Transactions
  module Serializers
    class FilteredCombinedSerializer < Panko::Serializer
      TYPE_BY_TRANSACTABLE = {
        "Transactions::Income" => "income",
        "Transactions::Expense" => "expense",
        "Transactions::Transfer" => "transfer"
      }.freeze

      attributes(
        :id,
        :date,
        :description,
        :to_account_name,
        :from_account_name,
        :category_name,
        :amount,
        :amount_currency,
        :booked_amount,
        :booked_amount_currency,
        :balance,
        :type,
        :in_series,
        :has_image,
        :has_loan_payment,
        :calculated,
      )

      def self.render_as_hash(source)
        serialized =
          if collection_source?(source)
            Panko::ArraySerializer.new(
              source,
              each_serializer: self,
            ).to_a
          else
            new.serialize(source)
          end

        deep_symbolize(serialized)
      end

      def self.collection_source?(source)
        source.is_a?(Array) || source.is_a?(ActiveRecord::Relation)
      end

      def self.deep_symbolize(value)
        case value
        when Array
          value.map { |item| normalize_row(item.deep_symbolize_keys) }
        when Hash
          normalize_row(value.deep_symbolize_keys)
        else
          value
        end
      end

      # Panko may emit JSON-oriented scalars (e.g. ISO date strings, BigDecimal as strings).
      # Match Blueprinter-style Ruby values for +render_as_hash+ consumers.
      def self.normalize_row(row)
        date_val = row[:date]
        if date_val.is_a?(String) && date_val.match?(/\A\d{4}-\d{2}-\d{2}\z/)
          row[:date] = Date.iso8601(date_val)
        end

        %i[amount booked_amount balance].each do |key|
          v = row[key]
          next unless v.is_a?(String) && v.match?(/\A-?\d+(\.\d+)?\z/)

          f = Float(v)
          row[key] = (f == f.to_i) ? f.to_i : f
        end

        row
      end

      private_class_method :collection_source?, :deep_symbolize, :normalize_row

      def id
        object.transactable_id
      end

      def amount
        t = object.transactable
        if t.respond_to?(:amount_in_space_currency)
          t.amount_in_space_currency[:amount]
        else
          object.value&.amount
        end
      end

      def amount_currency
        t = object.transactable
        if t.respond_to?(:amount_in_space_currency)
          t.amount_in_space_currency[:currency]
        else
          t.try(:amount_currency)
        end
      end

      def booked_amount
        t = object.transactable
        toggle = t.respond_to?(:booked_display_for_list_toggle) ? t.booked_display_for_list_toggle : nil
        raw =
          if toggle
            toggle[:amount]
          elsif t.respond_to?(:amount) && t.amount.present?
            t.amount.amount
          else
            object.value&.amount
          end
        coerce_numeric_for_json(raw)
      end

      def booked_amount_currency
        t = object.transactable
        toggle = t.respond_to?(:booked_display_for_list_toggle) ? t.booked_display_for_list_toggle : nil
        if toggle
          toggle[:currency]
        elsif t.respond_to?(:amount) && t.amount.present?
          t.amount.currency.to_s
        elsif t.respond_to?(:amount_currency)
          t.amount_currency.to_s
        end
      end

      def balance
        object.balance&.amount
      end

      def type
        TYPE_BY_TRANSACTABLE[object.transactable_type]
      end

      def in_series
        object.in_series?
      end

      def has_image
        object.transactable.files.attached?
      end

      def has_loan_payment
        object.transactable.respond_to?(:loan_payment) && object.transactable.loan_payment.present?
      end

      def calculated
        object.transactable.respond_to?(:balance_state) && object.transactable.balance_state == "calculated"
      end

      private

      def coerce_numeric_for_json(value)
        return if value.nil?
        return value unless value.is_a?(Numeric)

        f = value.to_f
        (f == f.to_i) ? f.to_i : f
      end
    end
  end
end
