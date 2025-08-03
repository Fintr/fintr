# frozen_string_literal: true

class CreateBetaWhiteList < ActiveRecord::Migration[8.0]
  def up
    create_table :beta_whitelists, id: :uuid do |t|
      t.string :email, null: false
      t.timestamps
    end

    add_index :beta_whitelists, :email, unique: true

    %w[
      miguel.dagatan@gmail.com
      joelpaoloparaiso@gmail.com
      stanleyhugo06@gmail.com
    ].each do |email|
      Beta::Whitelist.create!(email: email)
    end
  end

  def down
    drop_table :beta_whitelists
  end
end
