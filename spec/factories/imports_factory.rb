# frozen_string_literal: true

FactoryBot.define do
  factory :import, class: "Imports::Import" do
    association :user, factory: :user
    association :space, factory: :personal_space
    status { "pending" }
    import_location { "onboarding" }

    trait :processing do
      status { "processing" }
    end

    trait :completed do
      status { "completed" }
    end

    trait :failed do
      status { "failed" }
    end

    trait :reverted do
      status { "reverted" }
    end
  end
end
