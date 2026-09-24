# frozen_string_literal: true

class AddTagStyleImageToAiUsagesAiType < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL.squish
      ALTER TYPE ai_usages_ai_type ADD VALUE IF NOT EXISTS 'tag_style_image';
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          "PostgreSQL enum values cannot be removed safely"
  end
end
