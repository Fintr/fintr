# frozen_string_literal: true

FactoryBot.define do
  factory :spaces_access, class: "Spaces::Access" do
    association :space, factory: :space
    association :invited_by, factory: :user
    association :invited_user, factory: :user
    
    code { SecureRandom.alphanumeric(16).upcase }
    status { :active }
    expires_at { 7.days.from_now }
    used_at { nil }

    trait :used do
      status { :used }
      used_at { 1.day.ago }
    end

    trait :expired do
      status { :active }
      expires_at { 1.day.ago }
    end

    trait :revoked do
      status { :revoked }
    end
  end
end
