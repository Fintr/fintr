# frozen_string_literal: true

class CreateAiInteractions < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_interactions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
      t.string :session_id, null: false
      t.text :request, null: false
      t.text :enhanced_prompt
      t.text :response
      t.integer :tokens_used, default: 0
      t.string :status, default: 'pending'
      t.text :error
      t.jsonb :metadata, default: {}
      t.decimal :time_seconds, precision: 6, scale: 2, default: 0.0
      t.timestamps

      t.index [:user_id, :created_at]
      t.index [:space_id, :created_at]
      t.index [:session_id]
      t.index [:status]
    end
  end
end
