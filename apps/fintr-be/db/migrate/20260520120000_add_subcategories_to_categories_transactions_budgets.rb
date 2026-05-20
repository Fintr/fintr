# frozen_string_literal: true

class AddSubcategoriesToCategoriesTransactionsBudgets < ActiveRecord::Migration[8.0]
  def change
    add_reference :transactions_categories,
                  :parent,
                  foreign_key: { to_table: :transactions_categories },
                  type: :uuid,
                  index: true

    remove_index :transactions_categories,
                 name: "index_tx_categories_on_space_type_name"

    add_index :transactions_categories,
              %i[space_id category_type name],
              unique: true,
              where: "parent_id IS NULL",
              name: "index_tx_categories_roots_on_space_type_name"

    add_index :transactions_categories,
              %i[space_id category_type parent_id name],
              unique: true,
              where: "parent_id IS NOT NULL",
              name: "index_tx_categories_subs_on_space_type_parent_name"

    add_reference :transactions,
                  :subcategory,
                  foreign_key: { to_table: :transactions_categories },
                  type: :uuid,
                  index: true

    add_reference :budgets,
                  :subcategory,
                  foreign_key: { to_table: :transactions_categories },
                  type: :uuid,
                  index: true

    remove_index :budgets, name: "index_budgets_on_space_id_and_category_id_and_date"

    add_index :budgets,
              %i[space_id category_id date],
              unique: true,
              where: "subcategory_id IS NULL",
              name: "index_budgets_parent_per_month"

    add_index :budgets,
              %i[space_id category_id subcategory_id date],
              unique: true,
              where: "subcategory_id IS NOT NULL",
              name: "index_budgets_sub_per_month"
  end
end
