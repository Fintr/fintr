# frozen_string_literal: true

class AddTutorialFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users,
                :desktop_tutorial,
                :datetime,
                null: true
    add_column :users,
                :mobile_tutorial,
                :datetime,
                null: true
  end
end
