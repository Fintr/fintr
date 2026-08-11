# frozen_string_literal: true

class AddCategoryAndPositionToAchievements < ActiveRecord::Migration[8.0]
  def change
    add_column :achievements,
               :category,
               :string,
               null: false,
               default: "transactions"
    add_column :achievements,
               :position,
               :integer,
               null: false,
               default: 0

    add_index :achievements, [ :category, :position ]
  end
end
