# frozen_string_literal: true

require 'rails_helper'
require 'ice_cube'

RSpec.describe Utils::Recurrence do
  describe '.schedule' do
    let(:start_date) { Date.new(2024, 1, 15) }

    context 'when repeat_interval is :every_day' do
      it 'creates a daily schedule' do
        schedule = described_class.schedule(repeat_interval: :every_day, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::DailyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(1)
      end
    end

    context 'when repeat_interval is :every_week' do
      it 'creates a weekly schedule' do
        schedule = described_class.schedule(repeat_interval: :every_week, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::WeeklyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(1)
      end
    end

    context 'when repeat_interval is :every_2_weeks' do
      it 'creates a bi-weekly schedule' do
        schedule = described_class.schedule(repeat_interval: :every_2_weeks, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::WeeklyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(2)
      end
    end

    context 'when repeat_interval is :every_month' do
      it 'creates a monthly schedule' do
        schedule = described_class.schedule(repeat_interval: :every_month, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::MonthlyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(1)
      end
    end

    context 'when repeat_interval is :every_2_months' do
      it 'creates a schedule for every 2 months' do
        schedule = described_class.schedule(repeat_interval: :every_2_months, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::MonthlyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(2)
      end
    end

    context 'when repeat_interval is :every_3_months' do
      it 'creates a schedule for every 3 months' do
        schedule = described_class.schedule(repeat_interval: :every_3_months, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::MonthlyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(3)
      end
    end

    context 'when repeat_interval is :every_6_months' do
      it 'creates a schedule for every 6 months' do
        schedule = described_class.schedule(repeat_interval: :every_6_months, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::MonthlyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(6)
      end
    end

    context 'when repeat_interval is :every_year' do
      it 'creates a yearly schedule' do
        schedule = described_class.schedule(repeat_interval: :every_year, date: start_date)
        expect(schedule.rrules.first).to be_a(IceCube::YearlyRule)
        expect(schedule.rrules.first.to_hash[:interval]).to eq(1)
      end
    end

    context 'when repeat_interval is :installment' do
      let(:installment_period) { 3 }

      it 'creates a monthly schedule with a specific count' do
        schedule = described_class.schedule(
          repeat_interval: :installment,
          date: start_date,
          installment_period: installment_period
        )
        rule = schedule.rrules.first
        expect(rule).to be_a(IceCube::MonthlyRule)
        expect(rule.to_hash[:interval]).to eq(1)
        expect(rule.to_hash[:count]).to eq(installment_period)
        # Check occurrences to be sure about the count
        expect(schedule.occurrences_between(start_date, start_date + 1.year).count).to eq(installment_period)
      end

      it 'defaults to monthly if installment_period is nil (as per IceCube behavior)' do
        schedule = described_class.schedule(
          repeat_interval: :installment,
          date: start_date,
          installment_period: nil
        )
        rule = schedule.rrules.first
        expect(rule).to be_a(IceCube::MonthlyRule)
        expect(rule.to_hash[:interval]).to eq(1)
        # When count is nil for a rule, it means it repeats indefinitely for that rule type
        expect(rule.to_hash[:count]).to be_nil
      end
    end

    it 'sets the start date of the schedule' do
      schedule = described_class.schedule(repeat_interval: :every_day, date: start_date)
      expect(schedule.start_time.to_date).to eq(start_date)
    end
  end
end
