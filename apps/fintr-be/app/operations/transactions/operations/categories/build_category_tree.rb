# frozen_string_literal: true

module Transactions
  module Operations
    module Categories
      class BuildCategoryTree < Dry::Operation
        def self.normalize_tree_payload(tree)
          return [] if tree.blank?
          return tree if tree.is_a?(Array)

          [tree]
        end

        def call(categories)
          records = categories.to_a
          children_by_parent = records.group_by(&:parent_id)
          roots = records.select(&:root?)

          tree = Transactions::Serializers::CategorySerializer.render_as_hash(
            roots,
            children_by_parent:
          )
          self.class.normalize_tree_payload(tree)
        end
      end
    end
  end
end
