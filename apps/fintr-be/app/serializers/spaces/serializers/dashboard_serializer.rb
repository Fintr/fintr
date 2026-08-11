# frozen_string_literal: true

module Spaces
  module Serializers
    class DashboardSerializer < Blueprinter::Base
      identifier :id

      field :goal_description do |space|
        space.goal_description&.description ||
          "Set your own financial freedom goal, whatever milestone or lifestyle you're aiming for."
      end

      field :category_options do |space|
        serialize_category_tree(space.categories.roots.order(:name))
      end

      field :expense_category_options do |space|
        serialize_category_tree(space.expense_categories.roots.order(:name))
      end

      field :income_category_options do |space|
        serialize_category_tree(space.income_categories.roots.order(:name))
      end

      field :account_options do |space|
        space.accounts.kept.map do |account|
          {
            label: account.name,
            value: account.name,
            currency: account.balance_currency,
            account_category: account.account_category,
            balance: account.balance.amount
          }
        end
      end

      field :financial_summary do |dashboard_data|
        dashboard_data[:financial_summary]
      end

      field :earliest_transaction_date do |space|
        date = MonthlyFinancialSummaries::Queries::EarliestTransactionDateForSpace.call(
          space:,
        )

        date&.iso8601
      end

      def self.serialize_category_tree(roots)
        roots.map do |parent|
          {
            id: parent.id,
            label: parent.name,
            value: parent.id,
            name: parent.name,
            parent_id: nil,
            children: parent.children.order(:name).map do |child|
              {
                id: child.id,
                label: child.name,
                value: child.id,
                name: child.name,
                parent_id: parent.id
              }
            end
          }
        end
      end
    end
  end
end
