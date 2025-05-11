# frozen_string_literal: true

module Budgets
  module Serializers
    class MonthlyBudgetsSerializer < Blueprinter::Base
      identifier :id

      fields :date, :category_name, :total_spent, :amount_currency

      field :amount do |budget|
        budget.amount_cents / 100
      end
    end
  end
end
