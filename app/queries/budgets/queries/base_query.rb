# frozen_string_literal: true

module Budgets
  module Queries
    class BaseQuery < BaseQuery
      def initialize(relation: Budget.all, params: {})
        super(relation:, params:)
      end
    end
  end
end
