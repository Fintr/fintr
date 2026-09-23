# frozen_string_literal: true

FactoryBot.define do
  factory :revenuecat_customer, class: "Finance::RevenuecatCustomer" do
    association :user, factory: :user
    app_user_id { user.id }
    pro_active { false }
    synced_at { Time.current }
  end
end
