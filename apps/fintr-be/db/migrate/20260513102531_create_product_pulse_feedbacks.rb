# frozen_string_literal: true

class CreateProductPulseFeedbacks < ActiveRecord::Migration[8.1]
  def change
    create_table :product_pulse_feedbacks, id: :uuid do |t|
      t.references :user,
                   null: false,
                   foreign_key: { to_table: :users },
                   type: :uuid,
                   index: true
      t.references :space,
                   null: false,
                   foreign_key: { to_table: :spaces },
                   type: :uuid,
                   index: true
      t.string :period_key, null: false
      t.jsonb :liked_areas, null: false, default: []
      t.jsonb :improve_areas, null: false, default: []
      t.text :notes

      t.timestamps
    end

    add_index :product_pulse_feedbacks,
              %i[user_id space_id period_key],
              unique: true,
              name: "index_product_pulse_feedbacks_on_user_space_period"

    add_index :product_pulse_feedbacks,
              :created_at,
              order: { created_at: :desc }
  end
end
