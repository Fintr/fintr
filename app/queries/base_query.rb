# frozen_string_literal: true

class BaseQuery
  attr_reader :relation, :params

  def initialize(relation: nil, params: nil)
    @relation = relation
    @params = params
  end

  def self.call(**kwargs)
    new(**kwargs).call
  end
end
