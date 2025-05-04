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
        expect(DuplicateTransferJob).not_to receive(:perform_later)

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
        expect(DuplicateTransferJob).to receive(:perform_later).with(transfer.id)

        job.perform
      end
    end

    context 'when transfer has schedule that does not occur today' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new
        schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:monday))
        # Ensure the test doesn't run on a Monday to make it reliable
        allow(Time.zone).to receive(:today).and_return(Date.new(2023, 1, 3)) # This is a Tuesday
        schedule.to_hash
      end

      it 'does not call DuplicateTransferJob' do
        expect(DuplicateTransferJob).not_to receive(:perform_later)

        job.perform
      end
    end
  end
end
