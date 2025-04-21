# frozen_string_literal: true

class BaseQuery < Dry::Operation
  attr_reader :relation, :params

  def initialize(relation: nil, params: nil)
    @relation = relation
    @params = params
  end

  def self.call(**kwargs)
    new(**kwargs).call
  end

  def paginate(relation, params)
    return Success(relation) if params[:page].blank?

    Success(relation.page(params[:page]).per(params[:per_page] || 25))
  end
end
