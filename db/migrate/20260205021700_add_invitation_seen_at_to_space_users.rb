# frozen_string_literal: true

class AddInvitationSeenAtToSpaceUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :space_users, :invitation_seen_at, :datetime
    add_index :space_users, :invitation_seen_at
  end
end
