# frozen_string_literal: true

FactoryBot.define do
  factory :merchant_alias, class: "Entities::MerchantAlias" do
    association :space
    association :entity, factory: :entity, entity_type: "transaction"
    scanned_name { "corporation a" }
  end
end
