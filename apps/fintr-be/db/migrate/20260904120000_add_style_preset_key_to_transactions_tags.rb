# frozen_string_literal: true

class AddStylePresetKeyToTransactionsTags < ActiveRecord::Migration[8.0]
  def change
    add_column :transactions_tags,
               :style_preset_key,
               :string
  end
end
