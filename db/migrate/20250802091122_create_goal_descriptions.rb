# frozen_string_literal: true

class CreateGoalDescriptions < ActiveRecord::Migration[8.0]
  def change
    create_table :goal_descriptions, id: :uuid do |t|
      t.text :description
      t.references :space, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
