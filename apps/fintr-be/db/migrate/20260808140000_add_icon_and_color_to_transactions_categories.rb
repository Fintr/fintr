# frozen_string_literal: true

class AddIconAndColorToTransactionsCategories < ActiveRecord::Migration[8.0]
  def change
    change_table :transactions_categories, bulk: true do |t|
      t.string :icon
      t.string :color
    end
  end
end
