# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Payment, type: :model do
  let(:space) { create(:space) }
  let(:space_subscription) { create(:space_subscription, space: space) }
  let(:billing_cycle) { create(:finance_billing_cycle, space_subscription: space_subscription) }
  let(:payment) do
    create(
      :finance_payment,
      space_subscription: space_subscription,
      billing_cycle: billing_cycle
    )
  end

  describe "associations" do
    it { is_expected.to belong_to(:space_subscription).class_name("Finance::SpaceSubscription") }
    it { is_expected.to belong_to(:billing_cycle).class_name("Finance::BillingCycle").with_foreign_key("biling_cycle_id") }
  end

  describe "validations" do
    subject { build(:finance_payment, billing_cycle: billing_cycle, space_subscription: space_subscription) }

    it { is_expected.to validate_presence_of(:xendit_cycle_id) }
    it { is_expected.to validate_uniqueness_of(:xendit_cycle_id) }
    it { is_expected.to validate_presence_of(:amount_cents) }
    it { is_expected.to validate_numericality_of(:amount_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:amount_currency) }
    it { is_expected.to validate_presence_of(:status) }

    context "when amount_cents is zero" do
      it "is invalid" do
        payment = build(:finance_payment, amount_cents: 0)
        expect(payment).not_to be_valid
        expect(payment.errors[:amount_cents]).to include("must be greater than 0")
      end
    end

    context "when amount_cents is negative" do
      it "is invalid" do
        payment = build(:finance_payment, amount_cents: -100)
        expect(payment).not_to be_valid
        expect(payment.errors[:amount_cents]).to include("must be greater than 0")
      end
    end

    context "when xendit_cycle_id is not unique" do
      it "is invalid" do
        existing_payment = create(:finance_payment, xendit_cycle_id: "cycle-123", billing_cycle: billing_cycle, space_subscription: space_subscription)
        duplicate_payment = build(:finance_payment, xendit_cycle_id: "cycle-123", billing_cycle: billing_cycle, space_subscription: space_subscription)

        expect(duplicate_payment).not_to be_valid
        expect(duplicate_payment.errors[:xendit_cycle_id]).to include("has already been taken")
      end
    end
  end

  describe "monetize" do
    it { is_expected.to monetize(:amount_cents).with_model_currency(:amount_currency) }
  end

  describe "enum" do
    it "defines the correct enum values" do
      expect(described_class.statuses).to eq(
        "pending" => "pending",
        "succeeded" => "succeeded",
        "failed" => "failed",
        "refunded" => "refunded"
      )
    end

    context "when status is pending" do
      it "has correct status value" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, status: :pending, billing_cycle: cycle, space_subscription: subscription)
        expect(payment.status).to eq("pending")
        expect(payment.pending?).to be true
      end
    end

    context "when status is succeeded" do
      it "has correct status value" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, :succeeded, billing_cycle: cycle, space_subscription: subscription)
        expect(payment.status).to eq("succeeded")
        expect(payment.succeeded?).to be true
      end
    end

    context "when status is failed" do
      it "has correct status value" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, :failed, billing_cycle: cycle, space_subscription: subscription)
        expect(payment.status).to eq("failed")
        expect(payment.failed?).to be true
      end
    end

    context "when status is refunded" do
      it "has correct status value" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, :refunded, billing_cycle: cycle, space_subscription: subscription)
        expect(payment.status).to eq("refunded")
        expect(payment.refunded?).to be true
      end
    end
  end

  describe "scopes" do
    describe ".succeeded" do
      it "returns only succeeded payments" do
        subscription = create(:space_subscription)
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        cycle3 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 3)
        succeeded_payment = create(:finance_payment, :succeeded, billing_cycle: cycle1, space_subscription: subscription)
        create(:finance_payment, status: :pending, billing_cycle: cycle2, space_subscription: subscription)
        create(:finance_payment, :failed, billing_cycle: cycle3, space_subscription: subscription)

        expect(described_class.succeeded).to contain_exactly(succeeded_payment)
      end
    end

    describe ".failed" do
      it "returns only failed payments" do
        subscription = create(:space_subscription)
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        cycle3 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 3)
        failed_payment = create(:finance_payment, :failed, billing_cycle: cycle1, space_subscription: subscription)
        create(:finance_payment, status: :pending, billing_cycle: cycle2, space_subscription: subscription)
        create(:finance_payment, :succeeded, billing_cycle: cycle3, space_subscription: subscription)

        expect(described_class.failed).to contain_exactly(failed_payment)
      end
    end

    describe ".pending" do
      it "returns only pending payments" do
        subscription = create(:space_subscription)
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        cycle3 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 3)
        pending_payment = create(:finance_payment, status: :pending, billing_cycle: cycle1, space_subscription: subscription)
        create(:finance_payment, :succeeded, billing_cycle: cycle2, space_subscription: subscription)
        create(:finance_payment, :failed, billing_cycle: cycle3, space_subscription: subscription)

        expect(described_class.pending).to contain_exactly(pending_payment)
      end
    end

    describe ".for_subscription" do
      it "returns payments for the given subscription" do
        subscription = space_subscription
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        payment1 = create(:finance_payment, space_subscription: subscription, billing_cycle: cycle1)
        payment2 = create(:finance_payment, space_subscription: subscription, billing_cycle: cycle2)

        result = described_class.for_subscription(subscription.id)

        expect(result).to include(payment1)
        expect(result).to include(payment2)
        expect(result.count).to eq(2)
      end
    end

    describe ".by_date_range" do
      let(:start_date) { Time.zone.parse("2025-01-01 00:00:00") }
      let(:end_date) { Time.zone.parse("2025-01-31 23:59:59") }

      it "returns payments within the date range" do
        subscription = create(:space_subscription)
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        cycle3 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 3)
        cycle4 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 4)
        payment1 = create(:finance_payment, :succeeded, paid_at: Time.zone.parse("2025-01-15 12:00:00"), billing_cycle: cycle1, space_subscription: subscription)
        payment2 = create(:finance_payment, :succeeded, paid_at: Time.zone.parse("2025-01-20 12:00:00"), billing_cycle: cycle2, space_subscription: subscription)
        create(:finance_payment, :succeeded, paid_at: Time.zone.parse("2024-12-31 23:59:59"), billing_cycle: cycle3, space_subscription: subscription)
        create(:finance_payment, :succeeded, paid_at: Time.zone.parse("2025-02-01 00:00:00"), billing_cycle: cycle4, space_subscription: subscription)

        expect(described_class.by_date_range(start_date, end_date)).to contain_exactly(payment1, payment2)
      end

      it "includes payments at the start date" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        payment = create(:finance_payment, :succeeded, paid_at: start_date, billing_cycle: cycle, space_subscription: subscription)

        expect(described_class.by_date_range(start_date, end_date)).to include(payment)
      end

      it "includes payments at the end date" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        payment = create(:finance_payment, :succeeded, paid_at: end_date, billing_cycle: cycle, space_subscription: subscription)

        expect(described_class.by_date_range(start_date, end_date)).to include(payment)
      end
    end

    describe ".recent" do
      it "orders payments by paid_at desc, then created_at desc" do
        subscription = create(:space_subscription)
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        cycle3 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 3)
        payment1 = create(:finance_payment, :succeeded, paid_at: 2.days.ago, created_at: 1.day.ago, billing_cycle: cycle1, space_subscription: subscription)
        payment2 = create(:finance_payment, :succeeded, paid_at: 1.day.ago, created_at: 2.days.ago, billing_cycle: cycle2, space_subscription: subscription)
        payment3 = create(:finance_payment, :succeeded, paid_at: 1.day.ago, created_at: 1.day.ago, billing_cycle: cycle3, space_subscription: subscription)

        expect(described_class.recent.to_a).to eq([payment3, payment2, payment1])
      end

      it "handles payments without paid_at" do
        subscription = create(:space_subscription)
        cycle1 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 1)
        cycle2 = create(:finance_billing_cycle, space_subscription: subscription, cycle_number: 2)
        payment1 = create(:finance_payment, status: :pending, created_at: 2.days.ago, billing_cycle: cycle1, space_subscription: subscription)
        payment2 = create(:finance_payment, status: :pending, created_at: 1.day.ago, billing_cycle: cycle2, space_subscription: subscription)

        # Payments without paid_at should still be ordered by created_at
        recent_payments = described_class.recent.where(status: :pending).to_a
        expect(recent_payments).to eq([payment2, payment1])
      end
    end
  end

  describe "#space" do
    it "returns the space from space_subscription" do
      space = create(:space)
      subscription = create(:space_subscription, space: space)
      cycle = create(:finance_billing_cycle, space_subscription: subscription)
      payment = create(:finance_payment, space_subscription: subscription, billing_cycle: cycle)

      expect(payment.space).to eq(space)
    end
  end

  describe "#subscription_plan" do
    it "returns the subscription plan from space_subscription" do
      subscription_plan = create(:subscription_plan)
      subscription = create(:space_subscription, subscription_plan: subscription_plan)
      cycle = create(:finance_billing_cycle, space_subscription: subscription)
      payment = create(:finance_payment, space_subscription: subscription, billing_cycle: cycle)

      expect(payment.subscription_plan).to eq(subscription_plan)
    end
  end

  describe "#mark_as_paid!" do
    let(:paid_at_time) { Time.zone.parse("2025-01-15 12:00:00") }

    context "when payment is pending" do
      it "updates status to succeeded" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, status: :pending, billing_cycle: cycle, space_subscription: subscription)

        payment.mark_as_paid!

        expect(payment.reload.status).to eq("succeeded")
      end

      it "sets paid_at to current time by default" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, status: :pending, billing_cycle: cycle, space_subscription: subscription)
        freeze_time do
          payment.mark_as_paid!

          expect(payment.reload.paid_at).to be_within(1.second).of(Time.zone.now)
        end
      end

      it "sets paid_at to provided time" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, status: :pending, billing_cycle: cycle, space_subscription: subscription)

        payment.mark_as_paid!(paid_at: paid_at_time)

        expect(payment.reload.paid_at).to be_within(1.second).of(paid_at_time)
      end
    end

    context "when payment is already succeeded" do
      it "updates paid_at" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, :succeeded, paid_at: 1.day.ago, billing_cycle: cycle, space_subscription: subscription)

        payment.mark_as_paid!(paid_at: paid_at_time)

        expect(payment.reload.paid_at).to be_within(1.second).of(paid_at_time)
      end
    end

    context "when payment is failed" do
      it "updates status to succeeded" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, :failed, billing_cycle: cycle, space_subscription: subscription)

        payment.mark_as_paid!

        expect(payment.reload.status).to eq("succeeded")
      end
    end

    context "when update fails" do
      it "raises an error" do
        subscription = create(:space_subscription)
        cycle = create(:finance_billing_cycle, space_subscription: subscription)
        payment = create(:finance_payment, status: :pending, billing_cycle: cycle, space_subscription: subscription)
        allow(payment).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(payment))

        expect do
          payment.mark_as_paid!
        end.to raise_error(ActiveRecord::RecordInvalid)
      end
    end
  end
end
