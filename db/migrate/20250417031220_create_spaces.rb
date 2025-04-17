# frozen_string_literal: true

class CreateSpaces < ActiveRecord::Migration[8.0]
  def change
    create_table :spaces, id: :uuid do |t|
      t.string :name, null: false
      t.string :code, null: false
      t.string :currency, null: false, default: 'PHP'
      t.string :type, null: false

      t.timestamps
    end

    add_index :spaces, :code, unique: true
    add_index :spaces, :type
    add_index :spaces, :currency

    add_reference :transactions, :space, type: :uuid, index: true
  end
end
