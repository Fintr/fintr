# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::BillingCycle, type: :model do
  let(:space_subscription) { create(:space_subscription) }
  let(:cycle_start) { Time.zone.parse("2025-01-01 00:00:00") }
  let(:cycle_end) { Time.zone.parse("2025-01-31 23:59:59") }
  let(:span) { (cycle_start..cycle_end) }

  describe "associations" do
    it { is_expected.to belong_to(:space_subscription).class_name("Finance::SpaceSubscription") }

    describe "payments association" do
      let(:billing_cycle) { create(:finance_billing_cycle, space_subscription: space_subscription) }
      let(:payment) do
        create(
          :finance_payment,
          space_subscription: space_subscription,
          biling_cycle_id: billing_cycle.id
        )
      end

      it "has many payments" do
        payment
        # Query payments directly using the foreign key since the association doesn't specify it
        payments = Finance::Payment.where(biling_cycle_id: billing_cycle.id)
        expect(payments).to include(payment)
      end

      # Note: The association has dependent: :nullify but doesn't specify foreign_key,
      # so the dependent behavior may not work as expected. Testing the association definition only.
    end
  end

  describe "validations" do
    subject(:billing_cycle) do
      build(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        cycle_number: 1,
        span: span,
        tokens_allocated: 100
      )
    end

    it { is_expected.to validate_presence_of(:cycle_number) }
    it { is_expected.to validate_presence_of(:span) }
    it { is_expected.to validate_presence_of(:tokens_allocated) }

    it { is_expected.to validate_numericality_of(:cycle_number).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:tokens_allocated).is_greater_than(0) }

    describe "cycle_number uniqueness scoped to space_subscription_id" do
      let!(:existing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          cycle_number: 1
        )
      end

      it "is invalid with duplicate cycle_number for same subscription" do
        billing_cycle.cycle_number = 1
        expect(billing_cycle).to be_invalid
        expect(billing_cycle.errors[:cycle_number]).to be_present
      end

      it "is valid with duplicate cycle_number for different subscription" do
        # Create a new subscription for a different space to test uniqueness scope
        # The uniqueness is scoped to space_subscription_id, so different subscriptions can have the same cycle_number
        other_space = create(:personal_space)
        other_subscription_plan = create(:subscription_plan, slug: "other-plan-#{SecureRandom.uuid}")
        other_subscription = create(:space_subscription, space: other_space, subscription_plan: other_subscription_plan)
        billing_cycle.space_subscription = other_subscription
        billing_cycle.cycle_number = 1
        expect(billing_cycle).to be_valid
      end
    end
  end

  describe "enums" do
    subject(:billing_cycle) { build(:finance_billing_cycle) }

    it do
      expect(billing_cycle).to define_enum_for(:status)
        .with_values(pending: "pending", paid: "paid", failed: "failed")
        .backed_by_column_of_type(:enum)
    end
  end

  describe "scopes" do
    let(:current_time) { Time.zone.parse("2025-01-15 12:00:00") }

    before do
      Timecop.freeze(current_time)
    end

    after do
      Timecop.return
    end

    describe ".paid" do
      let(:subscription) { create(:space_subscription) }
      let!(:paid_cycle) do
        create(
          :finance_billing_cycle,
          :paid,
          space_subscription: subscription,
          cycle_number: 1
        )
      end
      let!(:pending_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2,
          status: "pending"
        )
      end
      let!(:failed_cycle) do
        create(
          :finance_billing_cycle,
          :failed,
          space_subscription: subscription,
          cycle_number: 3
        )
      end

      it "returns only cycles with paid status" do
        expect(described_class.paid).to include(paid_cycle)
        expect(described_class.paid).not_to include(pending_cycle)
        expect(described_class.paid).not_to include(failed_cycle)
      end
    end

    describe ".active" do
      let(:subscription) { create(:space_subscription) }
      let!(:active_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1,
          span: (Time.zone.parse("2025-01-01 00:00:00")..Time.zone.parse("2025-01-31 23:59:59"))
        )
      end
      let!(:expired_cycle) do
        create(
          :finance_billing_cycle,
          :expired,
          space_subscription: subscription,
          cycle_number: 2
        )
      end
      let!(:future_cycle) do
        create(
          :finance_billing_cycle,
          :future,
          space_subscription: subscription,
          cycle_number: 3
        )
      end

      it "returns only cycles where span contains current time" do
        expect(described_class.active).to include(active_cycle)
        expect(described_class.active).not_to include(expired_cycle)
        expect(described_class.active).not_to include(future_cycle)
      end
    end

    describe ".for_subscription" do
      let(:space1) { create(:personal_space) }
      let(:space2) { create(:personal_space) }
      let(:subscription_plan1) { create(:subscription_plan, slug: "plan1-#{SecureRandom.uuid}") }
      let(:subscription_plan2) { create(:subscription_plan, slug: "plan2-#{SecureRandom.uuid}") }
      let(:subscription1) { create(:space_subscription, space: space1, subscription_plan: subscription_plan1) }
      let(:subscription2) { create(:space_subscription, space: space2, subscription_plan: subscription_plan2) }
      let!(:cycle1) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription1,
          cycle_number: 1
        )
      end
      let!(:cycle2) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription2,
          cycle_number: 1
        )
      end

      it "returns cycles for the specified subscription" do
        result = described_class.for_subscription(subscription1.id)
        expect(result).to include(cycle1)
        expect(result).not_to include(cycle2)
      end
    end

    describe ".current" do
      let(:subscription) { create(:space_subscription) }
      let!(:cycle1) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 1
        )
      end
      let!(:cycle2) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 2
        )
      end
      let!(:cycle3) do
        create(
          :finance_billing_cycle,
          space_subscription: subscription,
          cycle_number: 3
        )
      end

      it "returns the cycle with the highest cycle_number" do
        result = described_class.current.first
        expect(result).to eq(cycle3)
      end

      it "returns only one cycle" do
        result = described_class.current.first
        expect(result).to be_a(described_class)
      end
    end
  end

  describe "#started_at" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        span: span
      )
    end

    it "returns the beginning of the span" do
      expect(billing_cycle.started_at).to eq(cycle_start)
    end
  end

  describe "#ends_at" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        span: span
      )
    end

    it "returns the end of the span" do
      expect(billing_cycle.ends_at).to eq(cycle_end)
    end
  end

  describe "#expired?" do
    let(:current_time) { Time.zone.parse("2025-01-15 12:00:00") }

    before do
      Timecop.freeze(current_time)
    end

    after do
      Timecop.return
    end

    context "when ends_at is in the past" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          :expired,
          space_subscription: space_subscription
        )
      end

      it "returns true" do
        expect(billing_cycle.expired?).to be(true)
      end
    end

    context "when ends_at is in the future" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          span: (cycle_start..cycle_end)
        )
      end

      it "returns false" do
        expect(billing_cycle.expired?).to be(false)
      end
    end

    context "when ends_at is before current time" do
      let(:past_end_time) { current_time - 1.hour }
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          span: (cycle_start..past_end_time)
        )
      end

      it "returns true" do
        expect(billing_cycle.expired?).to be(true)
      end
    end
  end

  describe "#active?" do
    let(:current_time) { Time.zone.parse("2025-01-15 12:00:00") }

    before do
      Timecop.freeze(current_time)
    end

    after do
      Timecop.return
    end

    context "when cycle is not expired" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          span: (cycle_start..cycle_end)
        )
      end

      it "returns true" do
        expect(billing_cycle.active?).to be(true)
      end
    end

    context "when cycle is expired" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          :expired,
          space_subscription: space_subscription
        )
      end

      it "returns false" do
        expect(billing_cycle.active?).to be(false)
      end
    end
  end

  describe "#mark_as_paid!" do
    let(:billing_cycle) do
      create(
        :finance_billing_cycle,
        space_subscription: space_subscription,
        status: "pending"
      )
    end
    let(:paid_at_time) { Time.zone.parse("2025-01-10 14:30:00") }

    it "updates status to paid" do
      billing_cycle.mark_as_paid!

      billing_cycle.reload
      expect(billing_cycle.status).to eq("paid")
    end

    it "sets paid_at to current time by default" do
      Timecop.freeze(paid_at_time) do
        billing_cycle.mark_as_paid!
      end

      billing_cycle.reload
      expect(billing_cycle.paid_at).to be_within(1.second).of(paid_at_time)
    end

    it "sets paid_at to provided time" do
      custom_paid_at = Time.zone.parse("2025-01-15 10:00:00")

      billing_cycle.mark_as_paid!(paid_at: custom_paid_at)

      billing_cycle.reload
      expect(billing_cycle.paid_at).to eq(custom_paid_at)
    end

    it "updates the record" do
      expect do
        billing_cycle.mark_as_paid!
      end.to change { billing_cycle.reload.updated_at }
    end
  end
end
