# frozen_string_literal: true

class UpdateAccountActivitiesToVersion3 < ActiveRecord::Migration[8.1]
  def up
    drop_view :account_activities, revert_to_version: 2
    create_view :account_activities, version: 3
  end

  def down
    drop_view :account_activities, revert_to_version: 3
    create_view :account_activities, version: 2
  end
end
