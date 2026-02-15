# frozen_string_literal: true

class IncreaseApiExchangeRatesRatePrecision < ActiveRecord::Migration[8.1]
  def up
    change_column :api_exchange_rates,
      :rate,
      :decimal,
      precision: 20,
      scale: 6,
      null: false
  end

  def down
    change_column :api_exchange_rates,
      :rate,
      :decimal,
      precision: 15,
      scale: 6,
      null: false
  end
end
