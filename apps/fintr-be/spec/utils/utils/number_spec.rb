# frozen_string_literal: true

require 'rails_helper'

# Note: ActionView::Helpers::NumberHelper is automatically available in Rails context
# If running outside of full Rails, it might need to be explicitly included or mocked.

RSpec.describe Utils::Number do
  describe '.format_money' do
    it 'formats a number to PHP currency with 2 decimal places' do
      expect(described_class.format_money(1234.567)).to eq('PHP1,234.57')
    end

    it 'formats an integer to PHP currency' do
      expect(described_class.format_money(5000)).to eq('PHP5,000.00')
    end

    it 'formats a small decimal to PHP currency' do
      expect(described_class.format_money(0.789)).to eq('PHP0.79')
    end

    it 'formats zero to PHP currency' do
      expect(described_class.format_money(0)).to eq('PHP0.00')
    end

    it 'handles negative numbers for money' do
      expect(described_class.format_money(-123.45)).to eq('-PHP123.45')
    end
  end

  describe '.format_percentage' do
    it 'formats a number to percentage with 2 decimal places' do
      expect(described_class.format_percentage(45.678)).to eq('45.68%')
    end

    it 'formats an integer to percentage' do
      expect(described_class.format_percentage(75)).to eq('75.00%')
    end

    it 'formats a small decimal to percentage' do
      expect(described_class.format_percentage(0.123)).to eq('0.12%')
    end

    it 'formats zero to percentage' do
      expect(described_class.format_percentage(0)).to eq('0.00%')
    end

    it 'handles negative numbers for percentage' do
      expect(described_class.format_percentage(-25.5)).to eq('-25.50%')
    end

    it 'formats a large number to percentage' do
      expect(described_class.format_percentage(12345.67)).to eq('12345.67%')
    end
  end

  describe '.format_decimal' do
    it 'formats a number with 2 decimal places and comma delimiter' do
      expect(described_class.format_decimal(12345.678)).to eq('12,345.68')
    end

    it 'formats an integer with 2 decimal places' do
      expect(described_class.format_decimal(5000)).to eq('5,000.00')
    end

    it 'formats a small decimal' do
      expect(described_class.format_decimal(0.129)).to eq('0.13')
    end

    it 'formats zero' do
      expect(described_class.format_decimal(0)).to eq('0.00')
    end

    it 'handles negative numbers for decimal' do
      expect(described_class.format_decimal(-4321.987)).to eq('-4,321.99')
    end
  end

  describe '.format_number' do
    it 'rounds a float to 2 decimal places' do
      expect(described_class.format_number(123.456)).to eq(123.46)
    end

    it 'rounds an integer (remains an integer if .00)' do
      # .round(2) on an integer like 5000 results in 5000 (Integer)
      # .round(2) on 5000.0 results in 5000.0 (Float)
      expect(described_class.format_number(5000)).to eq(5000)
      expect(described_class.format_number(5000.0)).to eq(5000.0)
    end

    it 'rounds a float with less than 2 decimal places (remains as is if float)' do
      expect(described_class.format_number(123.4)).to eq(123.4)
    end

    it 'handles zero' do
      expect(described_class.format_number(0)).to eq(0)
      expect(described_class.format_number(0.0)).to eq(0.0)
    end

    it 'handles negative numbers' do
      expect(described_class.format_number(-12.345)).to eq(-12.35)
      expect(described_class.format_number(-12.3)).to eq(-12.3)
    end

    it 'rounds numbers that result in .00 to a float with .0' do
      expect(described_class.format_number(12.00123)).to eq(12.0)
      expect(described_class.format_number(12.999)).to eq(13.0) # This will round up to 13.0
    end
  end
end
