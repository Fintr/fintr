# frozen_string_literal: true

class CreateOnboardings < ActiveRecord::Migration[8.0]
  ONBOARDING_STEP_ENUM = :onboarding_step_enum

  def change
    create_enum ONBOARDING_STEP_ENUM, %w[income budgets accounts completed]

    create_table :onboardings, id: :uuid do |t|
      t.references :user,
                   type: :uuid,
                   null: false,
                   foreign_key: { to_table: :users }
      t.enum :step,
             enum_type: ONBOARDING_STEP_ENUM,
             null: false,
             default: "income"

      t.jsonb :data, default: {}

      t.timestamps
    end
  end
end
