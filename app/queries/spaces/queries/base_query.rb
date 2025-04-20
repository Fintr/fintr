# frozen_string_literal: true

module Spaces
  module Queries
    class BaseQuery < ::BaseQuery
      def initialize(relation: Spaces::Space.all, params: {})
        super(relation:, params:)
      end
    end
  end
end
