# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Entitlements::ResolveProAccess, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }

  def call_operation
    operation.call(user_id: user.id, space_id: space.id)
  end

  it "grants Pro during the 7 day trial" do
    result = call_operation

    expect(result).to be_success
    expect(result.value![:pro]).to be(true)
    expect(result.value![:source]).to eq("trial")
    expect(result.value![:app_user_id]).to eq(user.id)
    expect(result.value![:trial_days_remaining]).to be_between(1, 7)
    expect(result.value![:features].map { |feature| feature[:key] }).to include(
      "dashboard_insights",
      "ai_receipt_scanning",
      "ai_chat",
      "bulk_ai_receipt_scanning",
      "tag_images",
    )
  end

  it "marks bulk receipt scanning as not available yet" do
    feature = call_operation.value![:features].find { |item| item[:key] == "bulk_ai_receipt_scanning" }

    expect(feature[:available]).to be(false)
  end

  it "denies Pro after the trial when nothing else grants access" do
    user.update!(trial_ends_at: 1.day.ago)

    result = call_operation

    expect(result.value![:pro]).to be(false)
    expect(result.value![:source]).to eq("none")
  end

  it "grants Pro to admins after the trial" do
    user.update!(trial_ends_at: 1.day.ago)
    user.add_role(:admin)

    expect(call_operation.value![:source]).to eq("admin")
  end

  it "grants Pro from an active paid space subscription after the trial" do
    user.update!(trial_ends_at: 1.day.ago)
    create(
      :space_subscription,
      space:,
      status: :active,
      subscription_type: :paid,
    )

    expect(call_operation.value![:source]).to eq("subscription")
  end

  it "does not treat a free space subscription as Pro" do
    user.update!(trial_ends_at: 1.day.ago)
    create(
      :space_subscription,
      space:,
      status: :active,
      subscription_type: :free,
    )

    expect(call_operation.value![:pro]).to be(false)
  end

  it "grants Pro from a current RevenueCat entitlement after the trial" do
    user.update!(trial_ends_at: 1.day.ago)
    create(
      :revenuecat_customer,
      user:,
      pro_active: true,
      pro_expires_at: 1.month.from_now,
    )

    expect(call_operation.value![:source]).to eq("revenuecat")
  end

  it "ignores an expired RevenueCat entitlement" do
    user.update!(trial_ends_at: 1.day.ago)
    create(
      :revenuecat_customer,
      user:,
      pro_active: true,
      pro_expires_at: 1.day.ago,
    )

    expect(call_operation.value![:pro]).to be(false)
  end
end
