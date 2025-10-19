# frozen_string_literal: true

class CreateConversations < ActiveRecord::Migration[7.1]
  def change
    create_table :ai_conversations, id: :uuid do |t|
      t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
      t.string :title, null: false
      t.datetime :last_message_at
      t.string :openai_conversation_id, null: false
      t.timestamps
    end

    add_index :ai_conversations, [:user_id, :created_at]
    add_index :ai_conversations, [:space_id, :created_at]
    add_index :ai_conversations, :last_message_at
    add_index :ai_conversations, :openai_conversation_id, unique: true
  end
end
