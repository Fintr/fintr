# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::CreateSponsorSubscription, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:admin_user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "pro-#{SecureRandom.hex(4)}", token_limit: 300, price_cents: 29_900, interval: "month") }

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      subscription_plan_id: subscription_plan.id.to_s,
      created_by: admin_user.id.to_s,
      sponsor_code: "TECH_CORP_2024",
      sponsor_notes: "Jane from TechCorp - YouTube sponsorship"
    }
  end

  before do
    create(:space_user, space:, user:)
  end

  describe "Contract validation" do
    let(:contract) { described_class::Contract.new }

    context "with valid parameters" do
      it "returns success" do
        result = contract.call(valid_params)
        expect(result).to be_success
      end
    end

    context "with missing space_id" do
      it "returns failure" do
        params = valid_params.except(:space_id)
        result = contract.call(params)
        expect(result).to be_failure
        expect(result.errors.to_h).to have_key(:space_id)
      end
    end

    context "with missing subscription_plan_id" do
      it "returns failure" do
        params = valid_params.except(:subscription_plan_id)
        result = contract.call(params)
        expect(result).to be_failure
        expect(result.errors.to_h).to have_key(:subscription_plan_id)
      end
    end

    context "with missing created_by" do
      it "returns failure" do
        params = valid_params.except(:created_by)
        result = contract.call(params)
        expect(result).to be_failure
        expect(result.errors.to_h).to have_key(:created_by)
      end
    end

    context "with optional sponsor_code" do
      it "returns success when sponsor_code is provided" do
        params = valid_params.merge(sponsor_code: "SPONSOR123")
        result = contract.call(params)
        expect(result).to be_success
      end

      it "returns success when sponsor_code is nil" do
        params = valid_params.merge(sponsor_code: nil)
        result = contract.call(params)
        expect(result).to be_success
      end
    end

    context "with optional sponsor_notes" do
      it "returns success when sponsor_notes is provided" do
        params = valid_params.merge(sponsor_notes: "Some notes about the sponsor")
        result = contract.call(params)
        expect(result).to be_success
      end

      it "returns success when sponsor_notes is nil" do
        params = valid_params.merge(sponsor_notes: nil)
        result = contract.call(params)
        expect(result).to be_success
      end
    end

    context "with optional total_cycles" do
      it "returns success when total_cycles is provided" do
        params = valid_params.merge(total_cycles: 12)
        result = contract.call(params)
        expect(result).to be_success
      end

      it "returns failure when total_cycles is zero" do
        params = valid_params.merge(total_cycles: 0)
        result = contract.call(params)
        expect(result).to be_failure
        expect(result.errors.to_h).to have_key(:total_cycles)
      end

      it "returns failure when total_cycles is negative" do
        params = valid_params.merge(total_cycles: -1)
        result = contract.call(params)
        expect(result).to be_failure
        expect(result.errors.to_h).to have_key(:total_cycles)
      end
    end

    context "with optional anchor_date" do
      it "returns success when anchor_date is provided" do
        params = valid_params.merge(anchor_date: Time.zone.now.to_datetime)
        result = contract.call(params)
        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "with valid parameters" do
      it "creates a sponsor subscription successfully" do
        result = operation.call(valid_params)

        expect(result).to be_success
        subscription = result.value!

        expect(subscription).to be_a(Finance::SpaceSubscription)
        expect(subscription.space).to eq(space)
        expect(subscription.subscription_plan).to eq(subscription_plan)
        expect(subscription.status).to eq("active")
        expect(subscription.subscription_type).to eq("sponsor")
      end

      it "creates subscription with sponsor metadata" do
        result = operation.call(valid_params)

        expect(result).to be_success
        subscription = result.value!

        expect(subscription.metadata).to include(
          "created_by" => admin_user.id.to_s,
          "sponsor_code" => "TECH_CORP_2024",
          "sponsor_notes" => "Jane from TechCorp - YouTube sponsorship"
        )
      end

      it "does not create Xendit subscription (no payment integration)" do
        result = operation.call(valid_params)

        expect(result).to be_success
        subscription = result.value!

        expect(subscription.xendit_plan_id).to be_nil
        expect(subscription.xendit_reference_id).to be_nil
        expect(subscription.xendit_customer_id).to be_nil
      end

      it "creates subscription with total_cycles" do
        params = valid_params.merge(total_cycles: 12)

        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value!

        expect(subscription.total_cycles).to eq(12)
      end

      it "creates an initial billing cycle as paid" do
        result = operation.call(valid_params)

        expect(result).to be_success
        subscription = result.value!

        billing_cycle = subscription.billing_cycles.first
        expect(billing_cycle).to be_present
        expect(billing_cycle.status).to eq("paid")
        expect(billing_cycle.cycle_number).to eq(1.0)
        expect(billing_cycle.tokens_allocated).to eq(subscription_plan.token_limit)
        expect(billing_cycle.xendit_cycle_id).to be_nil
        expect(billing_cycle.metadata).to include("sponsor_subscription" => true)
      end

      it "sets the subscription as active immediately" do
        result = operation.call(valid_params)

        expect(result).to be_success
        subscription = result.value!

        expect(subscription.active?).to be true
        expect(subscription.status).to eq("active")
      end
    end

    context "with invalid parameters" do
      it "returns failure when space_id is invalid" do
        params = valid_params.merge(space_id: "invalid-uuid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end

      it "returns failure when subscription_plan_id is invalid" do
        params = valid_params.merge(subscription_plan_id: "invalid-uuid")

        result = operation.call(params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription_plan_id)
      end
    end

    context "when space already has an active subscription" do
      it "returns failure" do
        create(
          :space_subscription,
          space: space,
          status: "active"
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
        expect(result.failure[:subscription]).to include("already has an active subscription")
      end
    end

    context "when space has a pending subscription" do
      it "returns failure" do
        create(
          :space_subscription,
          space: space,
          status: "pending"
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
      end
    end

    context "when space has a requires_action subscription" do
      it "returns failure" do
        create(
          :space_subscription,
          space: space,
          status: "requires_action"
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:subscription)
      end
    end
  end

  describe "billing cycle creation" do
    context "with monthly plan" do
      let(:monthly_plan) { create(:subscription_plan, slug: "monthly-#{SecureRandom.hex(4)}", token_limit: 100, price_cents: 9_900, interval: "month") }
      let(:anchor_date) { Time.zone.parse("2024-01-15 10:00:00") }

      it "creates billing cycle with 1 month duration" do
        params = valid_params.merge(
          subscription_plan_id: monthly_plan.id.to_s,
          anchor_date: anchor_date.to_datetime
        )

        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value!
        billing_cycle = subscription.billing_cycles.first

        expect(billing_cycle.started_at).to be_within(1.second).of(anchor_date)
        expect(billing_cycle.ends_at).to be_within(1.second).of(anchor_date + 1.month)
      end
    end

    context "with yearly plan" do
      let(:yearly_plan) { create(:subscription_plan, slug: "yearly-#{SecureRandom.hex(4)}", token_limit: 100, price_cents: 99_000, interval: "year") }
      let(:anchor_date) { Time.zone.parse("2024-01-15 10:00:00") }

      it "creates billing cycle with 1 year duration" do
        params = valid_params.merge(
          subscription_plan_id: yearly_plan.id.to_s,
          anchor_date: anchor_date.to_datetime
        )

        result = operation.call(params)

        expect(result).to be_success
        subscription = result.value!
        billing_cycle = subscription.billing_cycles.first

        expect(billing_cycle.started_at).to be_within(1.second).of(anchor_date)
        expect(billing_cycle.ends_at).to be_within(1.second).of(anchor_date + 1.year)
      end
    end
  end
end
