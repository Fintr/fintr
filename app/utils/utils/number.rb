# frozen_string_literal: true

module Utils
  module Number
    extend ActionView::Helpers::NumberHelper

    def self.format_money(number)
      number_to_currency(number, unit: "PHP", precision: 2)
    end

    def self.format_percentage(number)
      number_to_percentage(number, precision: 2)
    end

    def self.format_decimal(number)
      number_with_precision(number, precision: 2, delimiter: ",")
    end

    def self.format_number(number)
      number.round(2)
    end

    def self.format_delimiter(number)
      number_with_delimiter(number, precision: 2, delimiter: ",")
    end
  end
end
