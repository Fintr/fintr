# frozen_string_literal: true

class RenameDisplayCurrencyToCurrencyOnMonthlyFinancialSummaries < ActiveRecord::Migration[8.1]
  def up
    return unless column_exists?(:monthly_financial_summaries, :display_currency)

    rename_column :monthly_financial_summaries, :display_currency, :currency
  end

  def down
    return unless column_exists?(:monthly_financial_summaries, :currency)
    return if column_exists?(:monthly_financial_summaries, :display_currency)

    rename_column :monthly_financial_summaries, :currency, :display_currency
  end
end
