# frozen_string_literal: true

module Transactions
  module Queries
    module Transfers
      class BaseQuery < Transactions::Queries::BaseQuery
        def initialize(relation: Transactions::Transfer.all, params: {})
          super(relation:, params:)
        end
      end
    end
  end
end
