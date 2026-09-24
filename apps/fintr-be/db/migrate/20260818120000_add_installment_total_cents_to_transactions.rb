# frozen_string_literal: true

class AddInstallmentTotalCentsToTransactions < ActiveRecord::Migration[8.0]
  def change
    add_column :transactions, :installment_total_cents, :bigint
  end
end
