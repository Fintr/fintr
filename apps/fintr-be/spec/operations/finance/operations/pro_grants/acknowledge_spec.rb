# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::ProGrants::Acknowledge, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }

  it "records that the thank-you was seen" do
    create(:pro_grant, user:)

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!.acknowledged_at).to be_present
  end

  it "stays successful when the thank-you was already seen" do
    seen_at = 1.hour.ago
    create(:pro_grant, user:, acknowledged_at: seen_at)

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!.acknowledged_at).to be_within(1.second).of(seen_at)
  end

  it "fails when the account has no grant" do
    result = operation.call(user_id: user.id)

    expect(result).to be_failure
    expect(result.failure[:pro_grant]).to eq(["not found"])
  end
end
