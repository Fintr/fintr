# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Subscriptions::CalculateProration, type: :operation do
  let(:operation) { described_class.new }
  let(:space) { create(:space) }
  let(:old_plan) { create(:subscription_plan, slug: "basic", token_limit: 50, price_cents: 10_000, interval: "month") }
  let(:new_plan) { create(:subscription_plan, slug: "premium", token_limit: 100, price_cents: 20_000, interval: "month") }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: old_plan,
      status: "active"
    )
  end
  let(:current_cycle) do
    create(
      :finance_billing_cycle,
      :paid,
      space_subscription: space_subscription,
      cycle_number: 1,
      span: (Time.zone.now.beginning_of_month..Time.zone.now.end_of_month.end_of_day)
    )
  end

  let(:valid_params) do
    {
      current_subscription: space_subscription,
      new_plan: new_plan
    }
  end

  before do
    current_cycle
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "with missing current_subscription" do
      it "returns failure" do
        params = valid_params.except(:current_subscription)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:current_subscription)
      end
    end

    context "with missing new_plan" do
      it "returns failure" do
        params = valid_params.except(:new_plan)

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:new_plan)
      end
    end

    context "with optional effective_date" do
      it "returns success when effective_date is provided" do
        params = valid_params.merge(effective_date: Time.zone.now.to_datetime)

        result = operation.validate(params: params)

        expect(result).to be_success
      end

      it "returns success when effective_date is nil" do
        params = valid_params.merge(effective_date: nil)

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "when current subscription and new plan are the same" do
      let(:same_plan_params) do
        {
          current_subscription: space_subscription,
          new_plan: old_plan
        }
      end

      it "returns no_proration" do
        result = operation.call(same_plan_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:no_proration]).to be(true)
        expect(response[:action]).to be_nil
        expect(response[:same_plan]).to be(true)
      end
    end

    context "when there is no current paid cycle" do
      let(:space_without_cycle) { create(:space) }
      let(:space_subscription_without_cycle) do
        create(
          :space_subscription,
          space: space_without_cycle,
          subscription_plan: old_plan,
          status: "active"
        )
      end
      let(:params_without_cycle) do
        {
          current_subscription: space_subscription_without_cycle,
          new_plan: new_plan
        }
      end

      it "returns no_proration" do
        result = operation.call(params_without_cycle)

        expect(result).to be_success
        response = result.value!
        expect(response[:no_proration]).to be(true)
        expect(response[:action]).to be_nil
        expect(response[:no_current_cycle]).to be(true)
      end
    end

    context "when upgrading to a more expensive plan" do
      it "returns success with upgrade action" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:no_proration]).to be(false)
        expect(response[:action]).to eq("upgrade")
      end

      it "calculates prorated amount correctly" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:prorated_amount_cents]).to be > 0
      end

      it "includes all required fields in response" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        expect(response).to have_key(:days_elapsed)
        expect(response).to have_key(:days_remaining)
        expect(response).to have_key(:total_days)
        expect(response).to have_key(:prorated_amount_cents)
        expect(response).to have_key(:old_plan)
        expect(response).to have_key(:new_plan)
        expect(response).to have_key(:current_cycle)
        expect(response).to have_key(:effective_date)
        expect(response).to have_key(:old_daily_rate)
        expect(response).to have_key(:new_daily_rate)
      end
    end

    context "when downgrading to a cheaper plan" do
      let(:downgrade_plan) { create(:subscription_plan, slug: "starter", token_limit: 25, price_cents: 5_000, interval: "month") }
      let(:downgrade_params) do
        {
          current_subscription: space_subscription,
          new_plan: downgrade_plan
        }
      end

      it "returns success with downgrade action" do
        result = operation.call(downgrade_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:no_proration]).to be(false)
        expect(response[:action]).to eq("downgrade")
      end

      it "calculates negative prorated amount" do
        result = operation.call(downgrade_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:prorated_amount_cents]).to be < 0
      end
    end

    context "when plans have the same price" do
      let(:same_price_plan) { create(:subscription_plan, slug: "same_price", token_limit: 75, price_cents: 10_000, interval: "month") }
      let(:same_price_params) do
        {
          current_subscription: space_subscription,
          new_plan: same_price_plan
        }
      end

      it "returns success with nil action" do
        result = operation.call(same_price_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:no_proration]).to be(false)
        expect(response[:action]).to be_nil
      end

      it "calculates zero prorated amount" do
        result = operation.call(same_price_params)

        expect(result).to be_success
        response = result.value!
        expect(response[:prorated_amount_cents]).to eq(0)
      end
    end

    context "with effective_date" do
      let(:effective_date) { (Time.zone.now.beginning_of_month + 10.days).to_datetime }
      let(:params_with_date) do
        {
          current_subscription: space_subscription,
          new_plan: new_plan,
          effective_date: effective_date
        }
      end

      it "uses provided effective_date" do
        result = operation.call(params_with_date)

        expect(result).to be_success
        response = result.value!
        expect(response[:effective_date]).to be_within(1.second).of(effective_date)
      end

      it "calculates days based on effective_date" do
        result = operation.call(params_with_date)

        expect(result).to be_success
        response = result.value!
        expect(response[:days_elapsed]).to be >= 0
        expect(response[:days_remaining]).to be >= 0
      end
    end

    context "when effective_date is before cycle start" do
      let(:early_date) { (Time.zone.now.beginning_of_month - 1.day).to_datetime }
      let(:params_with_early_date) do
        {
          current_subscription: space_subscription,
          new_plan: new_plan,
          effective_date: early_date
        }
      end

      it "clamps effective_date to cycle start" do
        result = operation.call(params_with_early_date)

        expect(result).to be_success
        response = result.value!
        expect(response[:effective_date]).to be >= current_cycle.started_at
      end
    end

    context "when effective_date is after cycle end" do
      let(:late_date) { (Time.zone.now.end_of_month + 1.day).to_datetime }
      let(:params_with_late_date) do
        {
          current_subscription: space_subscription,
          new_plan: new_plan,
          effective_date: late_date
        }
      end

      it "clamps effective_date to cycle end" do
        result = operation.call(params_with_late_date)

        expect(result).to be_success
        response = result.value!
        expect(response[:effective_date]).to be <= current_cycle.ends_at
      end
    end

    context "when effective_date is not provided" do
      it "uses current time" do
        freeze_time = Time.zone.now

        travel_to(freeze_time) do
          result = operation.call(valid_params)

          expect(result).to be_success
          response = result.value!
          expect(response[:effective_date]).to be_within(1.second).of(freeze_time)
        end
      end
    end

    context "with day calculations" do
      let(:mid_month_date) { (Time.zone.now.beginning_of_month + 15.days).to_datetime }
      let(:params_mid_month) do
        {
          current_subscription: space_subscription,
          new_plan: new_plan,
          effective_date: mid_month_date
        }
      end

      it "calculates days_elapsed correctly" do
        result = operation.call(params_mid_month)

        expect(result).to be_success
        response = result.value!
        expected_days = (mid_month_date.to_date - current_cycle.started_at.to_date).to_i
        expect(response[:days_elapsed]).to eq(expected_days)
      end

      it "calculates total_days correctly" do
        result = operation.call(params_mid_month)

        expect(result).to be_success
        response = result.value!
        expected_total = (current_cycle.ends_at.to_date - current_cycle.started_at.to_date).to_i + 1
        expect(response[:total_days]).to eq(expected_total)
      end

      it "calculates days_remaining correctly" do
        result = operation.call(params_mid_month)

        expect(result).to be_success
        response = result.value!
        days_elapsed = (mid_month_date.to_date - current_cycle.started_at.to_date).to_i
        total_days = (current_cycle.ends_at.to_date - current_cycle.started_at.to_date).to_i + 1
        expected_remaining = total_days - days_elapsed
        expect(response[:days_remaining]).to eq(expected_remaining)
      end
    end

    context "with daily rate calculations" do
      it "calculates old_daily_rate correctly" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        total_days = response[:total_days]
        expected_old_rate = old_plan.price_cents.to_f / total_days
        expect(response[:old_daily_rate]).to be_within(0.01).of(expected_old_rate)
      end

      it "calculates new_daily_rate correctly" do
        result = operation.call(valid_params)

        expect(result).to be_success
        response = result.value!
        total_days = response[:total_days]
        expected_new_rate = new_plan.price_cents.to_f / total_days
        expect(response[:new_daily_rate]).to be_within(0.01).of(expected_new_rate)
      end
    end

    context "with prorated amount calculation" do
      let(:mid_month_date) { (Time.zone.now.beginning_of_month + 15.days).to_datetime }
      let(:params_mid_month) do
        {
          current_subscription: space_subscription,
          new_plan: new_plan,
          effective_date: mid_month_date
        }
      end

      it "calculates prorated amount for upgrade correctly" do
        result = operation.call(params_mid_month)

        expect(result).to be_success
        response = result.value!
        days_remaining = response[:days_remaining]
        old_daily_rate = response[:old_daily_rate]
        new_daily_rate = response[:new_daily_rate]
        expected_amount = (new_daily_rate - old_daily_rate) * days_remaining
        expect(response[:prorated_amount_cents]).to be_within(1).of(expected_amount.round)
      end

      it "calculates prorated amount for downgrade correctly" do
        downgrade_plan = create(:subscription_plan, slug: "starter", token_limit: 25, price_cents: 5_000, interval: "month")
        downgrade_params = params_mid_month.merge(new_plan: downgrade_plan)

        result = operation.call(downgrade_params)

        expect(result).to be_success
        response = result.value!
        days_remaining = response[:days_remaining]
        old_daily_rate = response[:old_daily_rate]
        new_daily_rate = response[:new_daily_rate]
        expected_amount = (new_daily_rate - old_daily_rate) * days_remaining
        expect(response[:prorated_amount_cents]).to be_within(1).of(expected_amount.round)
        expect(response[:prorated_amount_cents]).to be < 0
      end
    end

    context "when check_same_plan raises an error" do
      it "returns failure with error message" do
        allow(space_subscription).to receive(:subscription_plan_id).and_raise(StandardError.new("Database error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to check same plan")
      end
    end

    context "when get_current_cycle raises an error" do
      it "returns failure with error message" do
        allow(space_subscription).to receive(:current_paid_cycle).and_raise(StandardError.new("Database error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to get current cycle")
      end
    end

    context "when compare_plans raises an error" do
      it "returns failure with error message" do
        allow(space_subscription).to receive(:subscription_plan).and_raise(StandardError.new("Database error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to compare plans")
      end
    end


    context "when calculate_daily_rates raises an error" do
      it "returns failure with error message" do
        allow(space_subscription).to receive(:subscription_plan).and_raise(StandardError.new("Database error"))

        # Skip to daily rates calculation by mocking previous steps
        allow(operation).to receive(:check_same_plan).and_return(Success({ no_proration: false }))
        allow(operation).to receive(:get_current_cycle).and_return(Success({ no_proration: false, current_cycle: current_cycle }))
        allow(operation).to receive(:compare_plans).and_return(Success({ action: "upgrade" }))
        allow(operation).to receive(:calculate_cycle_dates).and_return(
          Success({
            cycle_start: current_cycle.started_at,
            cycle_end: current_cycle.ends_at,
            effective_date: Time.zone.now
          })
        )
        allow(operation).to receive(:calculate_days).and_return(
          Success({
            days_elapsed: 10,
            total_days: 30,
            days_remaining: 20
          })
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to calculate daily rates")
      end
    end

    context "when calculate_prorated_amount raises an error" do
      it "returns failure with error message" do
        # Skip to prorated amount calculation by mocking previous steps
        allow(operation).to receive(:check_same_plan).and_return(Success({ no_proration: false }))
        allow(operation).to receive(:get_current_cycle).and_return(Success({ no_proration: false, current_cycle: current_cycle }))
        allow(operation).to receive(:compare_plans).and_return(Success({ action: "upgrade" }))
        allow(operation).to receive(:calculate_cycle_dates).and_return(
          Success({
            cycle_start: current_cycle.started_at,
            cycle_end: current_cycle.ends_at,
            effective_date: Time.zone.now
          })
        )
        allow(operation).to receive(:calculate_days).and_return(
          Success({
            days_elapsed: 10,
            total_days: 30,
            days_remaining: nil
          })
        )
        allow(operation).to receive(:calculate_daily_rates).and_return(
          Success({
            old_daily_rate: 100.0,
            new_daily_rate: 200.0
          })
        )

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to calculate prorated amount")
      end
    end

    context "when build_result raises an error" do
      it "returns failure with error message" do
        # Skip to build_result by mocking previous steps
        allow(operation).to receive(:check_same_plan).and_return(Success({ no_proration: false }))
        allow(operation).to receive(:get_current_cycle).and_return(Success({ no_proration: false, current_cycle: current_cycle }))
        allow(operation).to receive(:compare_plans).and_return(Success({ action: "upgrade" }))
        allow(operation).to receive(:calculate_cycle_dates).and_return(
          Success({
            cycle_start: current_cycle.started_at,
            cycle_end: current_cycle.ends_at,
            effective_date: Time.zone.now
          })
        )
        allow(operation).to receive(:calculate_days).and_return(
          Success({
            days_elapsed: 10,
            total_days: 30,
            days_remaining: 20
          })
        )
        allow(operation).to receive(:calculate_daily_rates).and_return(
          Success({
            old_daily_rate: 100.0,
            new_daily_rate: 200.0
          })
        )
        allow(operation).to receive(:calculate_prorated_amount).and_return(
          Success({
            prorated_amount_cents: 2000
          })
        )
        allow(space_subscription).to receive(:subscription_plan).and_raise(StandardError.new("Database error"))

        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to include("Failed to build result")
      end
    end
  end
end
