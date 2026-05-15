# frozen_string_literal: true

class AddAdjustsAccountBalanceToLoanPayments < ActiveRecord::Migration[8.0]
  def up
    unless column_exists?(:loan_payments, :adjusts_account_balance)
      add_column :loan_payments,
                 :adjusts_account_balance,
                 :boolean,
                 default: true,
                 null: false
    end

    if column_exists?(:loan_payments, :counts_toward_principal)
      remove_column :loan_payments, :counts_toward_principal
    end
  end

  def down
    unless column_exists?(:loan_payments, :counts_toward_principal)
      add_column :loan_payments,
                 :counts_toward_principal,
                 :boolean,
                 default: true,
                 null: false
    end

    if column_exists?(:loan_payments, :adjusts_account_balance)
      remove_column :loan_payments, :adjusts_account_balance
    end
  end
end
