# frozen_string_literal: true

class MakeXenditCycleIdNullable < ActiveRecord::Migration[8.1]
  def up
    change_column_null :finance_billing_cycles, :xendit_cycle_id, true if column_is_not_nullable?(:finance_billing_cycles, :xendit_cycle_id)
    change_column_null :finance_payments, :xendit_cycle_id, true if column_is_not_nullable?(:finance_payments, :xendit_cycle_id)
  end

  def down
    change_column_null :finance_billing_cycles, :xendit_cycle_id, false if column_is_nullable?(:finance_billing_cycles, :xendit_cycle_id)
    change_column_null :finance_payments, :xendit_cycle_id, false if column_is_nullable?(:finance_payments, :xendit_cycle_id)
  end

  private

  def column_is_not_nullable?(table, column)
    !ActiveRecord::Base.connection.columns(table).find { |c| c.name == column }.null
  end

  def column_is_nullable?(table, column)
    ActiveRecord::Base.connection.columns(table).find { |c| c.name == column }.null
  end
end