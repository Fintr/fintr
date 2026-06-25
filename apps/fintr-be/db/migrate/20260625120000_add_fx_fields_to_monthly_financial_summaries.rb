# frozen_string_literal: true

class AddFxFieldsToMonthlyFinancialSummaries < ActiveRecord::Migration[8.1]
  def up
    add_column :monthly_financial_summaries, :currency, :string
    add_column :monthly_financial_summaries, :fx_based, :boolean, default: false, null: false

    execute <<~SQL.squish
      UPDATE monthly_financial_summaries
      SET currency = COALESCE(
        (SELECT spaces.currency FROM spaces WHERE spaces.id = monthly_financial_summaries.space_id),
        'PHP'
      )
    SQL

    change_column_null :monthly_financial_summaries, :currency, false
  end

  def down
    remove_column :monthly_financial_summaries, :fx_based
    remove_column :monthly_financial_summaries, :currency
  end
end
