# frozen_string_literal: true

class AddEntityIdToTransactions < ActiveRecord::Migration[8.1]
  def change
    add_reference :transactions,
                  :entity,
                  foreign_key: true,
                  type: :uuid,
                  null: true
  end
end
