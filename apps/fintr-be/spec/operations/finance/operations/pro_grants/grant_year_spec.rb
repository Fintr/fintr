# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::ProGrants::GrantYear, type: :operation do
  subject(:operation) { described_class.new }

  let(:admin) { create(:user) }
  let(:recipient) { create(:user, email: "early@example.com") }

  it "gives an existing account one year of Fintr Pro" do
    recipient

    result = operation.call(
      email: "Early@Example.com",
      granted_by_id: admin.id,
    )

    expect(result).to be_success
    grant = result.value!
    expect(grant.user).to eq(recipient)
    expect(grant.granted_by).to eq(admin)
    expect(grant.expires_at).to be_within(1.minute).of(1.year.from_now)
    expect(grant.acknowledged_at).to be_nil
  end

  it "refuses an email that has no account" do
    result = operation.call(
      email: "missing@example.com",
      granted_by_id: admin.id,
    )

    expect(result).to be_failure
    expect(result.failure[:email]).to eq(["No account uses that email"])
  end

  it "replaces an existing grant and shows the thank-you again" do
    create(
      :pro_grant,
      user: recipient,
      granted_by: admin,
      expires_at: 1.day.from_now,
      acknowledged_at: 1.hour.ago,
    )

    result = operation.call(
      email: recipient.email,
      granted_by_id: admin.id,
    )

    expect(result).to be_success
    expect(Finance::ProGrant.where(user: recipient).count).to eq(1)
    expect(result.value!.acknowledged_at).to be_nil
    expect(result.value!.expires_at).to be_within(1.minute).of(1.year.from_now)
  end
end
