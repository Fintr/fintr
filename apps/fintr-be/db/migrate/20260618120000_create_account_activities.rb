# frozen_string_literal: true

class CreateAccountActivities < ActiveRecord::Migration[8.0]
  def up
    return if view_exists?(:account_activities)

    create_view :account_activities
  end

  def down
    drop_view :account_activities, revert_to_version: 1 if view_exists?(:account_activities)
  end
end
