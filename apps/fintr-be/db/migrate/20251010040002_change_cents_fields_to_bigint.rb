# frozen_string_literal: true

class ChangeCentsFieldsToBigint < ActiveRecord::Migration[8.0]
  def up
    # Drop the view first since it uses the columns we're changing
    drop_view :combined_transactions, revert_to_version: 2

    # Change accounts table
    change_column :accounts, :balance_cents, :bigint, default: 0, null: false

    # Change budgets table
    change_column :budgets, :amount_cents, :bigint, default: 0, null: false
    change_column :budgets, :spent_cents, :bigint, default: 0, null: false

    # Change transactions table
    change_column :transactions, :amount_cents, :bigint, default: 0, null: false
    change_column :transactions, :balance_cents, :bigint, default: 0, null: false

    # Change transfers table
    change_column :transfers, :amount_cents, :bigint, default: 0, null: false
    change_column :transfers, :transaction_cost_cents, :bigint, default: 0, null: false

    # Recreate the view with updated column types
    create_view :combined_transactions, version: 2
  end

  def down
    # Drop the view
    drop_view :combined_transactions, revert_to_version: 2

    # Revert column changes
    change_column :accounts, :balance_cents, :integer, default: 0, null: false
    change_column :budgets, :amount_cents, :integer, default: 0, null: false
    change_column :budgets, :spent_cents, :integer, default: 0, null: false
    change_column :transactions, :amount_cents, :integer, default: 0, null: false
    change_column :transactions, :balance_cents, :integer, default: 0, null: false
    change_column :transfers, :amount_cents, :integer, default: 0, null: false
    change_column :transfers, :transaction_cost_cents, :integer, default: 0, null: false

    # Recreate the view
    create_view :combined_transactions, version: 2
  end
end
