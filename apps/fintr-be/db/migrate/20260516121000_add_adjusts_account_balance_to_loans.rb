# frozen_string_literal: true

class AddAdjustsAccountBalanceToLoans < ActiveRecord::Migration[8.0]
  def change
    add_column :loans,
               :adjusts_account_balance,
               :boolean,
               default: true,
               null: false
  end
end
