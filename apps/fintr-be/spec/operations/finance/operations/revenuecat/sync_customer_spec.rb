# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Revenuecat::SyncCustomer, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:client) { instance_double(Integrations::Revenuecat::Client) }

  before do
    allow(Integrations::Revenuecat::Client).to receive(:new).and_return(client)
    allow(client).to receive(:list_customer_subscriptions).and_return("items" => [])
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
    expect(record.revenuecat_subscription_id).to be_nil
  ensure
    ENV.delete("REVENUECAT_PRO_ENTITLEMENT_ID")
  end

  it "stores the store subscription that matches a local plan" do
    create(:subscription_plan, slug: "pro_yearly", name: "Pro Yearly", interval: "year")
    period_end = 1.year.from_now
    allow(client).to receive(:get_customer).with(customer_id: user.id).and_return(
      "id" => user.id,
      "active_entitlements" => { "items" => [] },
    )
    allow(client).to receive(:list_customer_subscriptions).with(customer_id: user.id).and_return(
      "items" => [
        {
          "id" => "sub_yearly",
          "product_id" => "prod_yearly",
          "store" => "test_store",
          "status" => "active",
          "gives_access" => true,
          "auto_renewal_status" => "will_renew",
          "starts_at" => Time.current.to_i * 1000,
          "current_period_ends_at" => period_end.to_i * 1000,
          "management_url" => "https://apps.apple.com/account/subscriptions",
          "entitlements" => {
            "items" => [
              {
                "products" => {
                  "items" => [
                    { "id" => "prod_monthly", "store_identifier" => "pro_monthly" },
                    { "id" => "prod_yearly", "store_identifier" => "pro_yearly" },
                  ],
                },
              },
            ],
          },
        },
      ],
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    record = result.value!
    expect(record.revenuecat_subscription_id).to eq("sub_yearly")
    expect(record.product_identifier).to eq("pro_yearly")
    expect(record.store).to eq("test_store")
    expect(record.gives_access).to be(true)
    expect(record.auto_renewal_status).to eq("will_renew")
    expect(record.management_url).to eq("https://apps.apple.com/account/subscriptions")
    expect(record.current_period_ends_at).to be_within(2.seconds).of(period_end)
  end

  it "loads the store identifier from the product when the subscription omits it" do
    create(:subscription_plan, slug: "pro_monthly", name: "Pro Monthly", interval: "month")
    allow(client).to receive(:get_customer).and_return(
      "id" => user.id,
      "active_entitlements" => { "items" => [] },
    )
    allow(client).to receive(:list_customer_subscriptions).and_return(
      "items" => [
        {
          "id" => "sub_monthly",
          "product_id" => "prod_monthly",
          "store" => "test_store",
          "gives_access" => true,
          "auto_renewal_status" => "will_renew",
          "status" => "active",
          "entitlements" => { "items" => [] },
        },
      ],
    )
    allow(client).to receive(:get_product).with(product_id: "prod_monthly").and_return(
      "store_identifier" => "pro_monthly",
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!.product_identifier).to eq("pro_monthly")
  end

  it "clears Pro when the customer does not exist yet" do
    allow(client).to receive(:get_customer).and_raise(Integrations::Revenuecat::NotFound.new)

    result = operation.call(user_id: user.id)

    expect(result).to be_success
    expect(result.value!.pro_active).to be(false)
  end
end
