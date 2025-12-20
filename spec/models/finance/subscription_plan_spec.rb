# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::SubscriptionPlan, type: :model do
  describe "table name" do
    it "is set to finance_subscription_plans" do
      expect(described_class.table_name).to eq("finance_subscription_plans")
    end
  end

  describe "associations" do
    it { is_expected.to have_many(:space_subscriptions).class_name("Finance::SpaceSubscription").dependent(:restrict_with_error) }
  end

  describe "validations" do
    subject(:subscription_plan) { build(:subscription_plan) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:slug) }
    it { is_expected.to validate_uniqueness_of(:slug) }
    it { is_expected.to validate_presence_of(:token_limit) }
    it { is_expected.to validate_numericality_of(:token_limit).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:price_cents) }
    it { is_expected.to validate_numericality_of(:price_cents).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:price_currency) }
    it { is_expected.to validate_presence_of(:interval) }
    it { is_expected.to validate_inclusion_of(:interval).in_array(%w[month year]) }

    describe "interval inclusion" do
      it "is valid with 'month'" do
        subscription_plan.interval = "month"
        expect(subscription_plan).to be_valid
      end

      it "is valid with 'year'" do
        subscription_plan.interval = "year"
        expect(subscription_plan).to be_valid
      end

      it "is invalid with other values" do
        subscription_plan.interval = "weekly"
        expect(subscription_plan).not_to be_valid
        expect(subscription_plan.errors[:interval]).to be_present
      end
    end

    describe "active inclusion" do
      it "is valid with true" do
        subscription_plan.active = true
        expect(subscription_plan).to be_valid
      end

      it "is valid with false" do
        subscription_plan.active = false
        expect(subscription_plan).to be_valid
      end

      it "is invalid with nil" do
        subscription_plan.active = nil
        expect(subscription_plan).not_to be_valid
        expect(subscription_plan.errors[:active]).to be_present
      end
    end
  end

  describe "monetize" do
    it { is_expected.to monetize(:price_cents).with_model_currency(:price_currency) }
  end

  describe "scopes" do
    describe ".active" do
      let!(:active_plan) { create(:subscription_plan, active: true, slug: "active-plan-#{SecureRandom.uuid}") }
      let!(:inactive_plan) { create(:subscription_plan, active: false, slug: "inactive-plan-#{SecureRandom.uuid}") }

      it "returns only active plans" do
        expect(described_class.active).to include(active_plan)
        expect(described_class.active).not_to include(inactive_plan)
      end
    end

    describe ".by_slug" do
      let!(:plan1) { create(:subscription_plan, slug: "basic-#{SecureRandom.uuid}") }
      let!(:plan2) { create(:subscription_plan, slug: "premium-#{SecureRandom.uuid}") }

      it "returns plan with matching slug" do
        result = described_class.by_slug(plan1.slug)
        expect(result).to include(plan1)
        expect(result).not_to include(plan2)
      end

      it "returns empty relation for non-existent slug" do
        result = described_class.by_slug("nonexistent-#{SecureRandom.uuid}")
        expect(result).to be_empty
      end
    end
  end

  describe "#free?" do
    context "when price_cents is zero" do
      let(:subscription_plan) { create(:subscription_plan, price_cents: 0) }

      it "returns true" do
        expect(subscription_plan.free?).to be true
      end
    end

    context "when price_cents is greater than zero" do
      let(:subscription_plan) { create(:subscription_plan, price_cents: 14_900) }

      it "returns false" do
        expect(subscription_plan.free?).to be false
      end
    end
  end
end
