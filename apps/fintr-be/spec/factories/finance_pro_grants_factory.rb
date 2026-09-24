# frozen_string_literal: true

FactoryBot.define do
  factory :pro_grant, class: "Finance::ProGrant" do
    association :user, factory: :user
    association :granted_by, factory: :user
    expires_at { 1.year.from_now }
  end
end
