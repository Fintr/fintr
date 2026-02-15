# frozen_string_literal: true

class AddDefaultTransactionCurrencyToSpaces < ActiveRecord::Migration[8.1]
  def change
    add_column :spaces,
      :default_transaction_currency,
      :string,
      limit: 3
  end
end
