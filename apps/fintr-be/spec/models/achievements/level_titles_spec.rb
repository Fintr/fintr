# frozen_string_literal: true

require "rails_helper"

RSpec.describe Achievements::LevelTitles do
  describe ".for_level" do
    it "returns Rookie Tracker for level 1" do
      expect(described_class.for_level(level: 1)[:title]).to eq("Rookie Tracker")
    end

    it "returns Fierce Budgeter for level 4" do
      expect(described_class.for_level(level: 4)[:title]).to eq("Fierce Budgeter")
    end

    it "returns Super Saver for level 5" do
      expect(described_class.for_level(level: 5)[:title]).to eq("Super Saver")
    end

    it "returns Money Maestro for level 10+" do
      expect(described_class.for_level(level: 99)[:title]).to eq("Money Maestro")
    end
  end
end
