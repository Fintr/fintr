# frozen_string_literal: true

class AddLabelToEntityMerchantAliases < ActiveRecord::Migration[8.1]
  def change
    add_column :entity_merchant_aliases, :label, :string
  end
end
