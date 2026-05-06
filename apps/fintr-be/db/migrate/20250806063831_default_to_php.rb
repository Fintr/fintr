# frozen_string_literal: true

class DefaultToPhp < ActiveRecord::Migration[8.0]
  def up
    change_column_default :transfers, :amount_currency, from: "USD", to: "PHP"
    change_column_default :transfers, :transaction_cost_currency, from: "USD", to: "PHP"
    change_column_default :accounts, :balance_currency, from: "USD", to: "PHP"
    change_column_default :budgets, :amount_currency, from: "USD", to: "PHP"
    change_column_default :budgets, :spent_currency, from: "USD", to: "PHP"
    change_column_default :transactions, :amount_currency, from: "USD", to: "PHP"
    change_column_default :transactions, :balance_currency, from: "USD", to: "PHP"

    Budget.update_all(amount_currency: "PHP", spent_currency: "PHP")
  end

  def down
    change_column_default :transfers, :amount_currency, from: "PHP", to: "USD"
    change_column_default :transfers, :transaction_cost_currency, from: "PHP", to: "USD"
    change_column_default :accounts, :balance_currency, from: "PHP", to: "USD"
    change_column_default :budgets, :amount_currency, from: "PHP", to: "USD"
    change_column_default :budgets, :spent_currency, from: "PHP", to: "USD"
    change_column_default :transactions, :amount_currency, from: "PHP", to: "USD"
    change_column_default :transactions, :balance_currency, from: "PHP", to: "USD"
  end
end
