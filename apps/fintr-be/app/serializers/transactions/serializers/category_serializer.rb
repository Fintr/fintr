# frozen_string_literal: true

module Transactions
  module Serializers
    class CategorySerializer < Blueprinter::Base
      identifier :id

      fields :name, :category_type, :icon, :color

      field :parent_id do |category|
        category.parent_id
      end

      field :children do |category, options|
        children = options[:children_by_parent]&.[](category.id) || []
        CategorySerializer.render_as_hash(children)
      end
    end
  end
end
