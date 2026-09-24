# frozen_string_literal: true

class SwitchActiveStorageBlobsToGoogle < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL.squish
      UPDATE active_storage_blobs
      SET service_name = 'google'
      WHERE service_name = 'amazon'
    SQL
  end

  def down
    execute <<~SQL.squish
      UPDATE active_storage_blobs
      SET service_name = 'amazon'
      WHERE service_name = 'google'
    SQL
  end
end
