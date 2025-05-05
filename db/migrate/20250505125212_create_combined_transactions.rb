# frozen_string_literal: true

class CreateCombinedTransactions < ActiveRecord::Migration[8.0]
  def change
    create_view :combined_transactions
  end
end
