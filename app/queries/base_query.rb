# frozen_string_literal: true

class BaseQuery
  def initialize(relation: nil, params: nil)
    @relation = relation
    @params = params
  end

  attr_reader :relation, :params

  def self.call(**kwargs)
    new(**kwargs).call
  end

  def call(relation: nil, params: nil) ; end
end
