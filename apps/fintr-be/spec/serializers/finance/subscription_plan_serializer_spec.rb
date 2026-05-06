# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::SubscriptionPlanSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(subscription_plan) }

  let(:subscription_plan) do
    create(
      :subscription_plan,
      name: "Basic Plan",
      slug: "basic",
      description: "A basic subscription plan",
      token_limit: 100,
      price_cents: 14_900,
      price_currency: "PHP",
      interval: "month",
      active: true
    )
  end

  it "includes the id" do
    expect(serialized_hash[:id]).to eq(subscription_plan.id)
  end

  it "includes the name" do
    expect(serialized_hash[:name]).to eq("Basic Plan")
  end

  it "includes the slug" do
    expect(serialized_hash[:slug]).to eq("basic")
  end

  it "includes the description" do
    expect(serialized_hash[:description]).to eq("A basic subscription plan")
  end

  it "includes tokenLimit (camelCase for token_limit)" do
    expect(serialized_hash[:tokenLimit]).to eq(100)
  end

  it "includes priceCents (camelCase for price_cents)" do
    expect(serialized_hash[:priceCents]).to eq(14_900)
  end

  it "includes priceCurrency (camelCase for price_currency)" do
    expect(serialized_hash[:priceCurrency]).to eq("PHP")
  end

  it "includes the interval" do
    expect(serialized_hash[:interval]).to eq("month")
  end

  it "includes the active status" do
    expect(serialized_hash[:active]).to be true
  end

  it "includes createdAt (camelCase for created_at)" do
    expect(serialized_hash[:createdAt]).to be_present
    expect(serialized_hash[:createdAt]).to be_a(Time)
  end

  it "includes updatedAt (camelCase for updated_at)" do
    expect(serialized_hash[:updatedAt]).to be_present
    expect(serialized_hash[:updatedAt]).to be_a(Time)
  end

  it "serializes all expected fields" do
    expected_keys = [
      :id,
      :name,
      :slug,
      :description,
      :tokenLimit,
      :priceCents,
      :priceCurrency,
      :interval,
      :active,
      :createdAt,
      :updatedAt
    ]
    expect(serialized_hash.keys).to match_array(expected_keys)
  end

  context "when subscription plan has different values" do
    let(:subscription_plan) do
      create(
        :subscription_plan,
        name: "Premium Plan",
        slug: "premium",
        description: "A premium subscription plan",
        token_limit: 500,
        price_cents: 39_900,
        price_currency: "USD",
        interval: "year",
        active: false
      )
    end

    it "includes the correct name" do
      expect(serialized_hash[:name]).to eq("Premium Plan")
    end

    it "includes the correct slug" do
      expect(serialized_hash[:slug]).to eq("premium")
    end

    it "includes the correct description" do
      expect(serialized_hash[:description]).to eq("A premium subscription plan")
    end

    it "includes the correct tokenLimit" do
      expect(serialized_hash[:tokenLimit]).to eq(500)
    end

    it "includes the correct priceCents" do
      expect(serialized_hash[:priceCents]).to eq(39_900)
    end

    it "includes the correct priceCurrency" do
      expect(serialized_hash[:priceCurrency]).to eq("USD")
    end

    it "includes the correct interval" do
      expect(serialized_hash[:interval]).to eq("year")
    end

    it "includes the correct active status" do
      expect(serialized_hash[:active]).to be false
    end
  end

  context "when description is nil" do
    let(:subscription_plan) do
      create(
        :subscription_plan,
        name: "Plan Without Description",
        slug: "no-description",
        description: nil
      )
    end

    it "includes nil for description" do
      expect(serialized_hash[:description]).to be_nil
    end

    it "still serializes all other fields" do
      expect(serialized_hash).to have_key(:id)
      expect(serialized_hash).to have_key(:name)
      expect(serialized_hash).to have_key(:slug)
    end
  end

  context "when price_cents is zero (free plan)" do
    let(:subscription_plan) do
      create(
        :subscription_plan,
        name: "Free Plan",
        slug: "free",
        price_cents: 0,
        price_currency: "PHP"
      )
    end

    it "includes zero for priceCents" do
      expect(serialized_hash[:priceCents]).to eq(0)
    end

    it "still includes priceCurrency" do
      expect(serialized_hash[:priceCurrency]).to eq("PHP")
    end
  end
end
