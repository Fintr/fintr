# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::UpdateSubscriptionCycleCountJob, type: :job do
  let(:job) { described_class.new }
  let(:space_subscription) { create(:space_subscription, current_cycle_count: 5) }
  let(:space_subscription_id) { space_subscription.id }
  let(:cycle_number) { 6 }

  before do
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:error)
  end

  describe "#perform" do
    context "when space_subscription is found" do
      context "when cycle_number is greater than current_cycle_count" do
        it "updates the current_cycle_count" do
          job.perform(space_subscription_id:, cycle_number:)

          space_subscription.reload
          expect(space_subscription.current_cycle_count).to eq(cycle_number)
        end

        it "logs the update" do
          expect(Rails.logger).to receive(:info).with(
            "Updated cycle count for subscription #{space_subscription_id} to #{cycle_number}"
          )

          job.perform(space_subscription_id:, cycle_number:)
        end
      end

      context "when cycle_number is equal to current_cycle_count" do
        let(:cycle_number) { 5 }

        it "does not update the current_cycle_count" do
          expect do
            job.perform(space_subscription_id:, cycle_number:)
          end.not_to change { space_subscription.reload.current_cycle_count }
        end

        it "logs the skip" do
          expect(Rails.logger).to receive(:info).with(
            "Skipped cycle count update for subscription #{space_subscription_id}: " \
            "cycle_number #{cycle_number} is not greater than current #{space_subscription.current_cycle_count}"
          )

          job.perform(space_subscription_id:, cycle_number:)
        end
      end

      context "when cycle_number is less than current_cycle_count" do
        let(:cycle_number) { 3 }

        it "does not update the current_cycle_count" do
          expect do
            job.perform(space_subscription_id:, cycle_number:)
          end.not_to change { space_subscription.reload.current_cycle_count }
        end

        it "logs the skip" do
          expect(Rails.logger).to receive(:info).with(
            "Skipped cycle count update for subscription #{space_subscription_id}: " \
            "cycle_number #{cycle_number} is not greater than current #{space_subscription.current_cycle_count}"
          )

          job.perform(space_subscription_id:, cycle_number:)
        end
      end

      context "when cycle_number is nil" do
        let(:cycle_number) { nil }

        it "does not update the current_cycle_count" do
          expect do
            job.perform(space_subscription_id:, cycle_number:)
          end.not_to change { space_subscription.reload.current_cycle_count }
        end

        it "logs the skip" do
          expect(Rails.logger).to receive(:info).with(
            "Skipped cycle count update for subscription #{space_subscription_id}: " \
            "cycle_number  is not greater than current #{space_subscription.current_cycle_count}"
          )

          job.perform(space_subscription_id:, cycle_number:)
        end
      end
    end

    context "when space_subscription is not found" do
      let(:space_subscription_id) { 999_999 }

      it "returns early without raising an error" do
        expect { job.perform(space_subscription_id:, cycle_number:) }.not_to raise_error
      end

      it "does not log anything" do
        expect(Rails.logger).not_to receive(:info)
        expect(Rails.logger).not_to receive(:error)

        job.perform(space_subscription_id:, cycle_number:)
      end
    end

    context "when an error occurs" do
      before do
        allow(Finance::SpaceSubscription).to receive(:find_by).and_raise(StandardError.new("Database error"))
      end

      it "logs the error" do
        expect(Rails.logger).to receive(:error).with(
          include("Failed to update cycle count for subscription #{space_subscription_id}: Database error")
        )

        expect { job.perform(space_subscription_id:, cycle_number:) }.to raise_error(StandardError)
      end

      it "raises the error" do
        expect { job.perform(space_subscription_id:, cycle_number:) }.to raise_error(StandardError, "Database error")
      end
    end
  end
end
