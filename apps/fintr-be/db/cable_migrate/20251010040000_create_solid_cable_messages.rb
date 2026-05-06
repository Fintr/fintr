# frozen_string_literal: true

class CreateSolidCableMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :solid_cable_messages, force: :cascade do |t|
      t.binary :channel, null: false
      t.binary :payload, null: false
      t.datetime :created_at, null: false
      t.bigint :channel_hash, null: false
    end

    add_index :solid_cable_messages, :channel, name: "index_solid_cable_messages_on_channel"
    add_index :solid_cable_messages, :channel_hash, name: "index_solid_cable_messages_on_channel_hash"
    add_index :solid_cable_messages, :created_at, name: "index_solid_cable_messages_on_created_at"
  end
end
