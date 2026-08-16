# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::SyncDailyRatesJob, type: :job do
  describe ".dates_needing_sync" do
    it "returns dates in the lookback window without a full API snapshot" do
      today = Date.current
      stale_date = today - 3.days
      allow(ExchangeRates::ApiExchangeRate).to receive(:full_snapshot_for_date?)
        .and_return(true)
      allow(ExchangeRates::ApiExchangeRate).to receive(:full_snapshot_for_date?)
        .with(date: stale_date)
        .and_return(false)

      expect(described_class.dates_needing_sync).to eq([stale_date])
    end
  end

  describe ".enqueue_if_needed!" do
    it "enqueues the job when snapshots are missing and none is pending" do
      allow(described_class).to receive(:dates_needing_sync).and_return([Date.current])
      allow(described_class).to receive(:pending?).and_return(false)

      expect { described_class.enqueue_if_needed! }
        .to have_enqueued_job(described_class)
    end

    it "does not enqueue when every date in the window already has a full snapshot" do
      allow(described_class).to receive(:dates_needing_sync).and_return([])

      expect { described_class.enqueue_if_needed! }
        .not_to have_enqueued_job(described_class)
    end
  end

  describe "#perform" do
    let(:operation) { instance_double(ExchangeRates::Operations::SyncApiRates) }

    before do
      allow(ExchangeRates::Operations::SyncApiRates).to receive(:new)
        .and_return(operation)
      allow(described_class).to receive(:dates_needing_sync).and_return([Date.current])
    end

    it "syncs API rates for dates that need a full snapshot" do
      allow(operation).to receive(:call)
        .with(date: Date.current)
        .and_return(
          Dry::Monads::Success(
            synced_count: 338,
            date: Date.current
          )
        )

      described_class.perform_now

      expect(operation).to have_received(:call).with(date: Date.current)
    end

    it "logs the synced count on success" do
      allow(operation).to receive(:call)
        .with(date: Date.current)
        .and_return(
          Dry::Monads::Success(
            synced_count: 338,
            date: Date.current
          )
        )
      allow(Rails.logger).to receive(:info)

      described_class.perform_now

      expect(Rails.logger).to have_received(:info).with(
        "Synced 338 exchange rates for #{Date.current}"
      )
    end

    it "logs the failure when syncing fails" do
      failure = { message: "No rates fetched from API" }
      allow(operation).to receive(:call)
        .with(date: Date.current)
        .and_return(Dry::Monads::Failure(failure))
      allow(Rails.logger).to receive(:error)

      described_class.perform_now

      expect(Rails.logger).to have_received(:error).with(
        "Failed to sync exchange rates for #{Date.current}: #{failure}"
      )
    end
  end
end
