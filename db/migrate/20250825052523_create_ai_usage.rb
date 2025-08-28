# frozen_string_literal: true

class CreateAiUsage < ActiveRecord::Migration[8.0]
  def change
    create_enum :ai_usages_ai_type, %w[pure_ai_ocr ai_chat]
    create_enum :ai_usages_ai_status, %w[pending success failure]
    create_table :ai_usages, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :space, type: :uuid, null: false, foreign_key: true
      t.enum :ai_type, enum_type: :ai_usages_ai_type, null: false, default: "pure_ai_ocr"
      t.enum :status, enum_type: :ai_usages_ai_status, null: false, default: "pending"
      t.integer :tokens_used, null: false, default: 1
      t.decimal :time_seconds, null: false, default: 0, precision: 6, scale: 2
      t.jsonb :result, null: false, default: {}
      t.timestamps
    end
  end
end
