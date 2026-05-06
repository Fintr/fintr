# frozen_string_literal: true

class CreateLoanPayments < ActiveRecord::Migration[8.0]
  def change
    create_table :loan_payments, id: :uuid do |t|
      t.references :loan, null: false, foreign_key: { to_table: :loans }, type: :uuid
      t.references :account, null: false, foreign_key: { to_table: :accounts }, type: :uuid
      t.references :transaction, null: true, foreign_key: { to_table: :transactions }, type: :uuid

      # Monetary fields
      t.bigint :principal_payment_cents, null: false
      t.bigint :interest_payment_cents, null: false
      t.bigint :total_payment_cents, null: false

      t.string :currency, null: false, default: 'PHP'

      # Payment details
      t.date :date, null: false
      t.text :notes

      t.timestamps
    end

    add_index :loan_payments, [:loan_id, :date]
    add_index :loan_payments, [:account_id, :date]
  end
end
