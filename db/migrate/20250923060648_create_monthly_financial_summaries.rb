# frozen_string_literal: true

class CreateMonthlyFinancialSummaries < ActiveRecord::Migration[7.0]
  def change
    create_table :monthly_financial_summaries do |t|
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
      t.integer :year, null: false
      t.integer :month, null: false
      t.decimal :total_income, precision: 15, scale: 2, null: false, default: 0
      t.decimal :total_expenses, precision: 15, scale: 2, null: false, default: 0
      t.decimal :net_savings, precision: 15, scale: 2, null: false, default: 0
      t.datetime :calculated_at, null: false

      t.timestamps
    end

    add_index :monthly_financial_summaries,
              [:space_id, :year, :month],
              unique: true,
              name: "index_monthly_financial_summaries_on_space_year_month"

    add_index :monthly_financial_summaries,
              [:year, :month],
              name: "index_monthly_financial_summaries_on_year_month"
  end
end
