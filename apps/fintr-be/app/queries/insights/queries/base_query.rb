# frozen_string_literal: true

module Insights
  module Queries
    class BaseQuery < BaseQuery
      def initialize(relation: Transactions::Transaction.all, params: {})
        super(relation:, params:)
      end
    end
  end
end
