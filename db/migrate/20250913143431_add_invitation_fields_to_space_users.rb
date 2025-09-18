# frozen_string_literal: true

class AddInvitationFieldsToSpaceUsers < ActiveRecord::Migration[8.0]
  def change
    add_reference :space_users, :invited_by, null: true, foreign_key: { to_table: :users }, type: :uuid
    add_column :space_users, :access_code, :string
    add_column :space_users, :invitation_status, :string, default: 'active'
    add_column :space_users, :invitation_expires_at, :datetime
    add_column :space_users, :invitation_used_at, :datetime
    
    # Add indexes for performance
    add_index :space_users, :access_code, unique: true
    add_index :space_users, :invitation_status
    add_index :space_users, :invitation_expires_at
    add_index :space_users, [:space_id, :invitation_status]
  end
end
