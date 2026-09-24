# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Revenuecat::PresentSubscription, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:plan) do
    create(
      :subscription_plan,
      slug: "pro_yearly",
      name: "Pro Yearly",
      interval: "year",
      price_cents: 100_000,
    )
  end

  it "returns an active card while the store subscription renews" do
    record = create(
      :revenuecat_customer,
      user: user,
      app_user_id: user.id,
      revenuecat_subscription_id: "sub_yearly",
      product_identifier: plan.slug,
      store: "test_store",
      gives_access: true,
      auto_renewal_status: "will_renew",
      starts_at: Time.zone.parse("2026-09-23 12:00:00"),
      current_period_ends_at: Time.zone.parse("2027-09-23 12:00:00"),
      management_url: "https://apps.apple.com/account/subscriptions",
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    card = result.value!
    expect(card[:provider]).to eq("revenuecat")
    expect(card[:status]).to eq("active")
    expect(card[:id]).to eq(record.id)
    expect(card[:management_url]).to eq("https://apps.apple.com/account/subscriptions")
    expect(card[:grace_period_ends_at]).to be_nil
    expect(card[:can_change_plan]).to be(false)
    expect(card[:subscription_plan][:name]).to eq("Pro Yearly")
    expect(card[:billing_cycles].first[:ends_at]).to eq(record.current_period_ends_at.iso8601)
  end

  it "keeps access until the period ends after the customer cancels renewal" do
    ends_at = Time.zone.parse("2027-09-23 12:00:00")
    create(
      :revenuecat_customer,
      user: user,
      app_user_id: user.id,
      revenuecat_subscription_id: "sub_yearly",
      product_identifier: plan.slug,
      gives_access: true,
      auto_renewal_status: "will_not_renew",
      starts_at: Time.zone.parse("2026-09-23 12:00:00"),
      current_period_ends_at: ends_at,
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value![:status]).to eq("inactive")
    expect(result.value![:grace_period_ends_at]).to eq(ends_at.iso8601)
  end

  it "returns nothing when the store product is not a local plan" do
    create(
      :revenuecat_customer,
      user: user,
      app_user_id: user.id,
      revenuecat_subscription_id: "sub_other",
      product_identifier: "unknown_product",
      gives_access: true,
      auto_renewal_status: "will_renew",
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!).to be_nil
  end
end
