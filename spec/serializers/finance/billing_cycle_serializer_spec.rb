# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::BillingCycleSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(billing_cycle) }

  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "basic", token_limit: 50, price_cents: 14_900, interval: "month") }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      status: "active"
    )
  end
  let(:billing_cycle) do
    create(
      :finance_billing_cycle,
      :paid,
      space_subscription: space_subscription,
      cycle_number: 1,
      tokens_allocated: 100,
      xendit_cycle_id: "recy_123",
      span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day),
      action_url: "https://example.com/action",
      scheduled_timestamp: Time.zone.parse("2025-01-15 10:00:00"),
      paid_at: Time.zone.parse("2025-01-15 12:00:00")
    )
  end

  it "includes the id" do
    expect(serialized_hash[:id]).to eq(billing_cycle.id)
  end

  it "includes cycleNumber with correct name transformation" do
    expect(serialized_hash[:cycleNumber]).to eq(1)
  end

  it "includes status" do
    expect(serialized_hash[:status]).to eq("paid")
  end

  it "includes actionUrl with correct name transformation" do
    expect(serialized_hash[:actionUrl]).to eq("https://example.com/action")
  end

  it "includes startedAt with ISO8601 format" do
    expect(serialized_hash[:startedAt]).to eq(billing_cycle.started_at.iso8601)
  end

  it "includes endsAt with ISO8601 format" do
    expect(serialized_hash[:endsAt]).to eq(billing_cycle.ends_at.iso8601)
  end

  it "includes paidAt with ISO8601 format" do
    expect(serialized_hash[:paidAt]).to eq(billing_cycle.paid_at.iso8601)
  end

  it "includes scheduledTimestamp with ISO8601 format" do
    expect(serialized_hash[:scheduledTimestamp]).to eq(billing_cycle.scheduled_timestamp.iso8601)
  end

  it "includes tokensAllocated with correct name transformation" do
    expect(serialized_hash[:tokensAllocated]).to eq(100)
  end

  it "includes xenditCycleId with correct name transformation" do
    expect(serialized_hash[:xenditCycleId]).to eq("recy_123")
  end

  it "serializes all expected fields" do
    expected_keys = [
      :id,
      :cycleNumber,
      :status,
      :actionUrl,
      :startedAt,
      :endsAt,
      :paidAt,
      :scheduledTimestamp,
      :tokensAllocated,
      :xenditCycleId
    ]
    expect(serialized_hash.keys).to match_array(expected_keys)
  end

  context "when cycle_number is a whole number" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        cycle_number: 2,
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "formats cycle_number as integer" do
      expect(serialized_hash[:cycleNumber]).to eq(2)
      expect(serialized_hash[:cycleNumber]).to be_a(Integer)
    end
  end

  context "when cycle_number is a decimal" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        cycle_number: 1.5,
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "formats cycle_number rounded to 1 decimal place" do
      expect(serialized_hash[:cycleNumber]).to eq(1.5)
    end
  end

  context "when cycle_number is a decimal that rounds to whole number" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        cycle_number: 2.0,
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "formats cycle_number as integer when it equals the integer value" do
      expect(serialized_hash[:cycleNumber]).to eq(2)
      expect(serialized_hash[:cycleNumber]).to be_a(Integer)
    end
  end

  context "when cycle_number has more than 1 decimal place" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        cycle_number: 1.75,
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "rounds cycle_number to 1 decimal place" do
      expect(serialized_hash[:cycleNumber]).to eq(1.8)
    end
  end


  context "when paid_at is nil" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        status: "pending",
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "includes nil for paidAt" do
      expect(serialized_hash[:paidAt]).to be_nil
    end
  end

  context "when scheduled_timestamp is nil" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        scheduled_timestamp: nil,
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "includes nil for scheduledTimestamp" do
      expect(serialized_hash[:scheduledTimestamp]).to be_nil
    end
  end

  context "when action_url is nil" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        action_url: nil,
        span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
      )
    end

    it "includes nil for actionUrl" do
      expect(serialized_hash[:actionUrl]).to be_nil
    end
  end

  context "with different status values" do
    context "when status is pending" do
      subject(:serialized_hash_pending) { described_class.render_as_hash(billing_cycle_pending) }

      let(:billing_cycle_pending) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          status: "pending",
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end

      it "includes pending status" do
        expect(serialized_hash_pending[:status]).to eq("pending")
      end
    end

    context "when status is failed" do
      subject(:serialized_hash_failed) { described_class.render_as_hash(billing_cycle_failed) }

      let(:billing_cycle_failed) do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: space_subscription,
          span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
        )
      end

      it "includes failed status" do
        expect(serialized_hash_failed[:status]).to eq("failed")
      end
    end
  end
end
