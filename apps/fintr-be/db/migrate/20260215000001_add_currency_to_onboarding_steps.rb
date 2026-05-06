# frozen_string_literal: true

class AddCurrencyToOnboardingSteps < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    execute <<-SQL.squish
      ALTER TYPE onboarding_step_enum ADD VALUE IF NOT EXISTS 'currency'
    SQL
    change_column_default :onboardings, :step, from: "income", to: "currency"
  end

  def down
    change_column_default :onboardings, :step, from: "currency", to: "income"
  end
end
