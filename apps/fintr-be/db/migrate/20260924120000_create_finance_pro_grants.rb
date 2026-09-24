# frozen_string_literal: true

class CreateFinanceProGrants < ActiveRecord::Migration[8.1]
  def change
    create_table :finance_pro_grants, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :user,
                   type: :uuid,
                   null: false,
                   foreign_key: { to_table: :users },
                   index: { unique: true }
      t.references :granted_by,
                   type: :uuid,
                   null: false,
                   foreign_key: { to_table: :users }
      t.datetime :expires_at, null: false
      t.datetime :acknowledged_at
      t.timestamps
    end
  end
end
