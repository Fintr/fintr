# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::ReconcileSubscriptionCycleCountsJob, type: :job do
  let(:job) { described_class.new }
  let(:current_time) { Time.zone.now }
  # rubocop:disable RSpec/VerifiedDoubles
  # Using double instead of instance_double because max_cycle_number is a dynamically
  # selected SQL field from the query result (via SELECT paid_cycles.max_cycle_number),
  # not an actual method on Finance::SpaceSubscription. instance_double would fail
  # verification since it checks that all stubbed methods exist on the real class.
  let(:subscription1) { double("Finance::SpaceSubscription", id: 1, max_cycle_number: 6) }
  let(:subscription2) { double("Finance::SpaceSubscription", id: 2, max_cycle_number: 4) }
  # rubocop:enable RSpec/VerifiedDoubles
  let(:subscriptions) { instance_double(ActiveRecord::Relation) }

  before do
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:error)
    allow(Time.zone).to receive(:now).and_return(current_time)
  end

  describe "#perform" do
    context "when query succeeds and returns subscriptions" do
      let(:query_result) { Dry::Monads::Success.new(subscriptions) }

      before do
        allow(Finance::Queries::SubscriptionsNeedingCycleCountUpdate).to receive(:call).and_return(query_result)
        allow(subscriptions).to receive(:find_each).and_yield(subscription1).and_yield(subscription2)
      end

      it "calls the query with current_time" do
        expect(Finance::Queries::SubscriptionsNeedingCycleCountUpdate).to receive(:call).with(
          params: { current_time: current_time }
        )

        job.perform
      end

      it "enqueues UpdateSubscriptionCycleCountJob for each subscription" do
        expect(Finance::UpdateSubscriptionCycleCountJob).to receive(:perform_later).with(
          space_subscription_id: subscription1.id,
          cycle_number: 6
        )
        expect(Finance::UpdateSubscriptionCycleCountJob).to receive(:perform_later).with(
          space_subscription_id: subscription2.id,
          cycle_number: 4
        )

        job.perform
      end

      it "logs the start of the job" do
        expect(Rails.logger).to receive(:info).with("Starting ReconcileSubscriptionCycleCountsJob")

        job.perform
      end

      it "logs each enqueued subscription" do
        expect(Rails.logger).to receive(:info).with(
          "Enqueued cycle count update for subscription #{subscription1.id} " \
          "to cycle_number 6"
        )
        expect(Rails.logger).to receive(:info).with(
          "Enqueued cycle count update for subscription #{subscription2.id} " \
          "to cycle_number 4"
        )

        job.perform
      end

      it "logs the completion with enqueued count" do
        expect(Rails.logger).to receive(:info).with(
          "ReconcileSubscriptionCycleCountsJob completed. Enqueued: 2 subscriptions"
        )

        job.perform
      end
    end

    context "when query succeeds but returns empty relation" do
      let(:empty_subscriptions) { instance_double(ActiveRecord::Relation) }
      let(:query_result) { Dry::Monads::Success.new(empty_subscriptions) }

      before do
        allow(Finance::Queries::SubscriptionsNeedingCycleCountUpdate).to receive(:call).and_return(query_result)
        allow(empty_subscriptions).to receive(:find_each)
      end

      it "does not enqueue any jobs" do
        expect(Finance::UpdateSubscriptionCycleCountJob).not_to receive(:perform_later)

        job.perform
      end

      it "logs completion with zero enqueued count" do
        expect(Rails.logger).to receive(:info).with(
          "ReconcileSubscriptionCycleCountsJob completed. Enqueued: 0 subscriptions"
        )

        job.perform
      end
    end

    context "when query fails" do
      let(:query_result) { Dry::Monads::Failure.new(error: "Query failed") }

      before do
        allow(Finance::Queries::SubscriptionsNeedingCycleCountUpdate).to receive(:call).and_return(query_result)
      end

      it "returns early without enqueuing jobs" do
        expect(Finance::UpdateSubscriptionCycleCountJob).not_to receive(:perform_later)

        job.perform
      end

      it "does not log completion message" do
        expect(Rails.logger).not_to receive(:info).with(
          include("ReconcileSubscriptionCycleCountsJob completed")
        )

        job.perform
      end
    end

    context "when an error occurs during query execution" do
      before do
        allow(Finance::Queries::SubscriptionsNeedingCycleCountUpdate).to receive(:call).and_raise(
          StandardError.new("Database error")
        )
      end

      it "logs the error" do
        expect(Rails.logger).to receive(:error).with(
          include("ReconcileSubscriptionCycleCountsJob failed: Database error")
        )

        expect { job.perform }.to raise_error(StandardError)
      end

      it "raises the error" do
        expect { job.perform }.to raise_error(StandardError, "Database error")
      end
    end

    context "when an error occurs during job enqueuing" do
      let(:query_result) { Dry::Monads::Success.new(subscriptions) }

      before do
        allow(Finance::Queries::SubscriptionsNeedingCycleCountUpdate).to receive(:call).and_return(query_result)
        allow(subscriptions).to receive(:find_each).and_raise(StandardError.new("Enqueue error"))
      end

      it "logs the error" do
        expect(Rails.logger).to receive(:error).with(
          include("ReconcileSubscriptionCycleCountsJob failed: Enqueue error")
        )

        expect { job.perform }.to raise_error(StandardError)
      end

      it "raises the error" do
        expect { job.perform }.to raise_error(StandardError, "Enqueue error")
      end
    end
  end
end
