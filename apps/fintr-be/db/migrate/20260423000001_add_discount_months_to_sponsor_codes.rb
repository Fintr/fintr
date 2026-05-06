# frozen_string_literal: true

class AddDiscountMonthsToSponsorCodes < ActiveRecord::Migration[8.1]
  def change
    add_column :finance_sponsor_codes, :discount_months, :integer, null: true
    add_index :finance_sponsor_codes, :discount_months
  end
end
