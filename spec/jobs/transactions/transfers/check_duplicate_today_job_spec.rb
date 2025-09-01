# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Transfers::CheckDuplicateTodayJob, type: :job do
  subject(:job) { described_class.new }

  describe '#perform' do
    let(:space) { create(:personal_space) }
    let(:from_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:to_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:transfer) { create(:transfer, from_account:, to_account:, schedule: schedule_hash) }
    let(:schedule_hash) { {} }

    before do
      allow(Rails.logger).to receive(:info)
      # Stub the DuplicateTransferJob class that is referenced in the job without namespace
      stub_const("DuplicateTransferJob", Transactions::Transfers::DuplicateTransferJob)
    end

    context 'when transfer has no schedule' do
      it 'does not call DuplicateTransferJob' do
        expect(DuplicateTransferJob).not_to receive(:perform_later) # rubocop:disable RSpec/MessageSpies

        job.perform
      end
    end

    context 'when transfer has schedule that occurs today' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new
        schedule.add_recurrence_rule(IceCube::Rule.daily)
        schedule.to_hash
      end

      it 'calls DuplicateTransferJob with transfer id' do
        expect(DuplicateTransferJob).to receive(:perform_later).with(transfer.id) # rubocop:disable RSpec/MessageSpies

        job.perform
      end
    end

    context 'when transfer has schedule that does not occur today' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new(Time.utc(2022, 12, 26, 0, 0, 0)) # a Monday baseline
        schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:monday))
        schedule.to_hash
      end

      it 'does not call DuplicateTransferJob' do
        expect(DuplicateTransferJob).not_to receive(:perform_later) # rubocop:disable RSpec/MessageSpies

        travel_to(Time.utc(2023, 1, 3, 12, 0, 0)) do # Tuesday UTC
          job.perform(time_zone: 'UTC')
        end
      end
    end

    context 'with time zone differences across day boundaries' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new(Time.utc(2022, 12, 26, 0, 0, 0)) # a Monday baseline
        schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:monday))
        schedule.to_hash
      end

      it 'enqueues in Asia/Manila when it is Monday there but still Sunday UTC' do
        # 2023-01-01 16:30:00 UTC == 2023-01-02 00:30:00 Asia/Manila (Monday)
        expect(DuplicateTransferJob).to receive(:perform_later).with(transfer.id) # rubocop:disable RSpec/MessageSpies

        travel_to(Time.utc(2023, 1, 1, 16, 30, 0)) do
          job.perform(time_zone: 'Asia/Manila')
        end
      end

      it 'does not enqueue in UTC at the same instant (still Sunday UTC)' do
        expect(DuplicateTransferJob).not_to receive(:perform_later) # rubocop:disable RSpec/MessageSpies

        travel_to(Time.utc(2023, 1, 1, 16, 30, 0)) do
          job.perform(time_zone: 'UTC')
        end
      end
    end
  end
end
