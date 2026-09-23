# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Revenuecat::SyncCustomer, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:client) { instance_double(Integrations::Revenuecat::Client) }

  before do
    allow(Integrations::Revenuecat::Client).to receive(:new).and_return(client)
  end

  it "stores an active Pro entitlement from the customer payload" do
    allow(client).to receive(:get_customer).with(customer_id: user.id).and_return(
      "id" => user.id,
      "active_entitlements" => {
        "items" => [
          {
            "entitlement_id" => "ent_pro",
            "expires_at" => 2.months.from_now.to_i * 1000,
          },
        ],
      },
    )
    ENV["REVENUECAT_PRO_ENTITLEMENT_ID"] = "ent_pro"

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    record = result.value!
    expect(record.pro_active).to be(true)
    expect(record.app_user_id).to eq(user.id)
    expect(record.pro_expires_at).to be_future
  ensure
    ENV.delete("REVENUECAT_PRO_ENTITLEMENT_ID")
  end

  it "clears Pro when the customer does not exist yet" do
    allow(client).to receive(:get_customer).and_raise(Integrations::Revenuecat::NotFound.new)

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!.pro_active).to be(false)
  end
end
