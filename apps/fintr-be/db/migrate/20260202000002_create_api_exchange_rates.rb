# frozen_string_literal: true

class CreateApiExchangeRates < ActiveRecord::Migration[8.1]
  def change
    create_table :api_exchange_rates,
      id: :uuid,
      default: -> { "gen_random_uuid()" } do |t|
      t.string :base_currency, null: false, default: "USD"
      t.string :target_currency, null: false
      t.decimal :rate,
        precision: 15,
        scale: 6,
        null: false
      t.date :rate_date, null: false
      t.timestamps
    end

    add_index :api_exchange_rates,
      [:base_currency, :target_currency, :rate_date],
      unique: true,
      name: "idx_api_rates_unique_per_day"
    add_index :api_exchange_rates, [:target_currency, :rate_date]
    add_index :api_exchange_rates, :rate_date
  end
end
