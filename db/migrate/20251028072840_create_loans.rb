# frozen_string_literal: true

class CreateLoans < ActiveRecord::Migration[8.0]
  def change
    create_table :loans, id: :uuid do |t|
      t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
      t.references :account, null: false, foreign_key: { to_table: :accounts }, type: :uuid

      # Monetary fields
      t.bigint :principal_amount_cents, null: false
      t.bigint :outstanding_balance_cents, null: false
      t.string :currency, null: false, default: 'PHP'

      # Interest rate as decimal percentage
      t.decimal :interest_rate, precision: 5, scale: 2, null: false

      # Loan details
      t.date :date, null: false
      t.string :loan_type, null: false # 'borrowed' or 'lent'
      t.references :entity, null: false, foreign_key: { to_table: :entities }, type: :uuid
      t.integer :loan_term_months, null: false
      t.date :maturity_date, null: false
      t.string :status, default: 'active'
      t.date :paid_off_date
      t.text :description

      t.timestamps
    end

    add_index :loans, [:space_id, :loan_type]
    add_index :loans, [:space_id, :status]
    add_index :loans, :maturity_date
  end
end
