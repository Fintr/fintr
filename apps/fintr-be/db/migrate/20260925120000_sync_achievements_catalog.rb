# frozen_string_literal: true

class SyncAchievementsCatalog < ActiveRecord::Migration[8.1]
  def up
    Achievements::Achievement.reset_column_information
    Achievements::Catalog.sync!
  end

  def down
    # Reference badges stay in place so existing unlocks keep their rows.
  end
end
