# frozen_string_literal: true

FactoryBot.define do
  factory :entity, class: "Entities::Entity" do
    association :space
    full_name { "Test Entity" }
    entity_type { "loan" }
  end
end

