# frozen_string_literal: true

class CreateConversationMessages < ActiveRecord::Migration[7.1]
  def change
    create_table :ai_conversation_messages, id: :uuid do |t|
      t.references :conversation, null: false, foreign_key: { to_table: :ai_conversations }, type: :uuid
      t.text :content, null: false
      t.integer :openai_role, null: false, default: 0
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :ai_conversation_messages, [:conversation_id, :created_at]
    add_index :ai_conversation_messages, :openai_role
  end
end
