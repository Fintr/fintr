# frozen_string_literal: true

class UpdateExistingSpaceUsersInvitationStatus < ActiveRecord::Migration[8.0]
  def change
    # Update existing space_users records to have 'active' status (direct membership)
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE space_users#{' '}
          SET invitation_status = 'active'#{' '}
          WHERE invitation_status IS NULL
        SQL
      end

      dir.down do
        execute <<-SQL
          UPDATE space_users#{' '}
          SET invitation_status = NULL#{' '}
          WHERE invitation_status = 'active'
        SQL
      end
    end
  end
end
