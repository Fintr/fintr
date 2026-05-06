# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Onboarding, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
  end

  describe "attributes" do
    it "has a data (jsonb) attribute" do
      onboarding = create(:onboarding)
      expect(onboarding).to respond_to(:data)
      expect(onboarding.data).to be_a(Hash)
    end
  end

  describe "enums" do
    it "defines the correct step types" do
      expect(described_class.steps.keys).to match_array(%w[currency income budgets accounts completed])
      expect(described_class.steps.values).to match_array(%w[currency income budgets accounts completed])
    end

    it "allows setting a valid step type" do
      onboarding = build(:onboarding, step: "income")
      expect(onboarding).to be_valid
      expect(onboarding.step).to eq("income")
      expect(onboarding).to be_income
    end

    it "validates presence of step" do
      onboarding = build(:onboarding, step: nil)
      expect(onboarding).not_to be_valid
      expect(onboarding.errors[:step]).to include("can't be blank")
    end

    it "validates inclusion of step in allowed values" do
      expect { build(:onboarding, step: "invalid_type") }.to raise_error(ArgumentError)
    end
  end
end
