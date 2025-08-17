# frozen_string_literal: true

FactoryBot.define do
  factory :user, class: "Auth::User" do
    auth_id { SecureRandom.uuid }
    email { "#{SecureRandom.hex(6)}@example.com" }

    trait :admin do
      after(:create) do |user|
        user.add_role(:admin)
      end
    end

    factory :admin_user, traits: [:admin]
  end
end
