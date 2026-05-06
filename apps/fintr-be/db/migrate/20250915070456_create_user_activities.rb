# frozen_string_literal: true

class CreateUserActivities < ActiveRecord::Migration[8.0]
  def change
    create_table :user_activities, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.date :activity_date, null: false

      # Cumulative counters for different activity types
      t.integer :login_count, default: 0, null: false
      t.integer :api_request_count, default: 0, null: false
      t.integer :transaction_created_count, default: 0, null: false
      t.integer :dashboard_viewed_count, default: 0, null: false

      # Additional metrics
      t.integer :total_requests, default: 0, null: false

      t.timestamps
    end

    # Add indexes for efficient querying
    add_index :user_activities, [:user_id, :activity_date], unique: true
    add_index :user_activities, :activity_date
    add_index :user_activities, :total_requests
  end
end
