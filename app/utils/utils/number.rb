# frozen_string_literal: true

module Utils
  module Number
    extend ActionView::Helpers::NumberHelper

    def self.format_money(number)
      number_to_currency(number, unit: "₱", precision: 2)
    end
  end
end
