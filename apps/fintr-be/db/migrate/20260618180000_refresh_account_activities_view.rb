# frozen_string_literal: true

class RefreshAccountActivitiesView < ActiveRecord::Migration[8.1]
  def up
    return unless view_exists?(:account_activities)

    drop_view :account_activities, revert_to_version: 2
    create_view :account_activities, version: 2
  end

  def down
    # no-op: previous version already applied
  end
end
