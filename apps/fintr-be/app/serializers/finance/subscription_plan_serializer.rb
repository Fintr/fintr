# frozen_string_literal: true

module Finance
  class SubscriptionPlanSerializer < Blueprinter::Base
    identifier :id

    field :name
    field :slug
    field :description
    field :token_limit, name: :tokenLimit
    field :price_cents, name: :priceCents
    field :price_currency, name: :priceCurrency
    field :interval
    field :active
    field :created_at, name: :createdAt
    field :updated_at, name: :updatedAt
  end
end
