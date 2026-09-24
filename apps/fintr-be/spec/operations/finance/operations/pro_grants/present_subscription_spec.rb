# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::ProGrants::PresentSubscription, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }

  it "returns a one-year subscription that does not renew" do
    grant = create(:pro_grant, user:, expires_at: 1.year.from_now)

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    card = result.value!
    expect(card[:provider]).to eq("grant")
    expect(card[:status]).to eq("active")
    expect(card[:subscription_type]).to eq("grant")
    expect(card[:total_cycles]).to eq(1)
    expect(card[:can_change_plan]).to be(false)
    expect(card[:ended_at]).to eq(grant.expires_at.iso8601)
    expect(card[:subscription_plan][:price_cents]).to eq(0)
    expect(card[:subscription_plan][:interval]).to eq("year")
    expect(card[:billing_cycles].first[:ends_at]).to eq(grant.expires_at.iso8601)
  end

  it "returns nothing after the year has ended" do
    create(:pro_grant, user:, expires_at: 1.day.ago)

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!).to be_nil
  end
end
