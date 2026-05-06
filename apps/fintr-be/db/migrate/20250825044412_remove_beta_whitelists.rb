# frozen_string_literal: true

class RemoveBetaWhitelists < ActiveRecord::Migration[8.0]
  def change
    drop_table :beta_whitelists
  end
end
