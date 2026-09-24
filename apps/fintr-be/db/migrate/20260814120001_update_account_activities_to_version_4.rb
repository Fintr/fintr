# frozen_string_literal: true

class UpdateAccountActivitiesToVersion4 < ActiveRecord::Migration[8.1]
  def up
    drop_view :account_activities, revert_to_version: 3
    create_view :account_activities, version: 4
  end

  def down
    drop_view :account_activities, revert_to_version: 4
    create_view :account_activities, version: 3
  end
end
