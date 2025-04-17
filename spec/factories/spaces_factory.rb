# frozen_string_literal: true

FactoryBot.define do
  factory :space do
    sequence(:name) { |n| "Space #{n}" }
    sequence(:code) { |n| "space-#{n}" }
    currency { "PHP" }
    type { "Spaces::PersonalSpace" }

    factory :personal_space, class: "Spaces::PersonalSpace" do
      type { "Spaces::PersonalSpace" }
    end

    factory :organization_space, class: "Spaces::OrganizationSpace" do
      type { "Spaces::OrganizationSpace" }
    end
  end
end
