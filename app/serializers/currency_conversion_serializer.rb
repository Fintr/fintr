# frozen_string_literal: true

class CurrencyConversionSerializer < Blueprinter::Base
  identifier :id

  field :original_amount do |conversion|
    conversion.original_money.amount
  end

  field :original_currency

  field :converted_amount do |conversion|
    conversion.converted_money.amount
  end

  field :converted_currency

  field :exchange_rate
  field :source
  field :rate_timestamp
  field :note
end
