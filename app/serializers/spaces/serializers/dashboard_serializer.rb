# frozen_string_literal: true

module Spaces
  module Serializers
    class DashboardSerializer < Blueprinter::Base
      identifier :id

      field :goal_description do |space|
        space.goal_description&.description ||
          "Having enough passive income to cover my expenses and being able to travel 3 months a year."
      end

      field :category_options do |space|
        space.categories.map do |category|
          {
            label: category.name,
            value: category.name
          }
        end
      end

      field :expense_category_options do |space|
        space.expense_categories.map do |category|
          {
            label: category.name,
            value: category.name
          }
        end
      end

      field :income_category_options do |space|
        space.income_categories.map do |category|
          {
            label: category.name,
            value: category.name
          }
        end
      end

      field :account_options do |space|
        space.accounts.kept.map do |account|
          {
            label: account.name,
            value: account.name
          }
        end
      end
    end
  end
end
