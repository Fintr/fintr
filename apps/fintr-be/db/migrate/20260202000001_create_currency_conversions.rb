# frozen_string_literal: true

class CreateCurrencyConversions < ActiveRecord::Migration[8.1]
  def change
    create_table :currency_conversions,
      id: :uuid,
      default: -> { "gen_random_uuid()" } do |t|
      t.uuid :convertible_id, null: false
      t.string :convertible_type, null: false
      t.uuid :space_id, null: false
      t.bigint :original_amount_cents, null: false
      t.string :original_currency, null: false
      t.bigint :converted_amount_cents, null: false
      t.string :converted_currency, null: false
      t.decimal :exchange_rate,
        precision: 15,
        scale: 6,
        null: false
      t.string :source, null: false
      t.datetime :rate_timestamp, null: false
      t.text :note
      t.timestamps
    end

    add_index :currency_conversions,
      [:convertible_type, :convertible_id],
      unique: true,
      name: "idx_currency_conversions_unique_per_convertible"
    add_index :currency_conversions, :space_id
    add_index :currency_conversions,
      [:space_id, :original_currency, :converted_currency, :rate_timestamp],
      name: "idx_currency_conversions_space_currencies_timestamp"
    add_index :currency_conversions, [:original_currency, :converted_currency]
    add_index :currency_conversions, :created_at
    add_foreign_key :currency_conversions, :spaces
  end
end
