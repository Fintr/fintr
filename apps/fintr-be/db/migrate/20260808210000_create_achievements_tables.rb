# frozen_string_literal: true

class CreateAchievementsTables < ActiveRecord::Migration[8.0]
  def change
    create_table :achievements, id: :uuid do |t|
      t.string :key, null: false
      t.string :title, null: false
      t.text :description, null: false, default: ""
      t.integer :xp_reward, null: false, default: 50
      t.string :rarity, null: false, default: "common"
      t.string :kind, null: false, default: "collectible"
      t.string :image_key, null: false
      t.string :unlock_event, null: false
      t.jsonb :unlock_threshold, null: false, default: {}
      t.boolean :active, null: false, default: true

      t.timestamps
    end

    add_index :achievements, :key, unique: true
    add_index :achievements, :unlock_event
    add_index :achievements, :active

    create_table :user_achievements, id: :uuid do |t|
      t.references :user,
                   null: false,
                   type: :uuid,
                   foreign_key: { to_table: :users }
      t.references :achievement,
                   null: false,
                   type: :uuid,
                   foreign_key: true
      t.references :space,
                   null: true,
                   type: :uuid,
                   foreign_key: { to_table: :spaces }
      t.datetime :earned_at, null: false
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :user_achievements,
              [ :user_id, :achievement_id ],
              unique: true,
              name: "index_user_achievements_on_user_and_achievement"
    add_index :user_achievements, :earned_at

    create_table :user_gamification_stats, id: :uuid do |t|
      t.references :user,
                   null: false,
                   type: :uuid,
                   foreign_key: { to_table: :users },
                   index: { unique: true }
      t.integer :xp, null: false, default: 0
      t.integer :level, null: false, default: 1

      t.timestamps
    end
  end
end
