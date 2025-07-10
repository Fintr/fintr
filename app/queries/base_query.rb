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

  private

  def paginate(relation, params)
    # NOTE: Hack-y way to make sure there's no records if there's no page.
    Success(relation.page(params[:page]|| 99999).per(params[:per_page] || 25))
  end
end
