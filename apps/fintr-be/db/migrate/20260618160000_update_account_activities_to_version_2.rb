# frozen_string_literal: true

class UpdateAccountActivitiesToVersion2 < ActiveRecord::Migration[8.1]
  def up
    drop_view :account_activities, revert_to_version: 1
    create_view :account_activities, version: 2
  end

  def down
    drop_view :account_activities, revert_to_version: 2
    create_view :account_activities, version: 1
  end
end
