module Transactions
  module Queries
    class BaseQuery < BaseQuery
      attr_reader :relation, :params

      def initialize(relation: Transactions::Transaction.all, params: {})
        super(relation:, params:)
      end
    end
  end
end
