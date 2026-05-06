# frozen_string_literal: true

class CreateBetaWhiteList < ActiveRecord::Migration[8.0]
  def up
    create_table :beta_whitelists, id: :uuid do |t|
      t.string :email, null: false
      t.timestamps
    end

    add_index :beta_whitelists, :email, unique: true
  end

  def down
    drop_table :beta_whitelists
  end
end
