# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Tag do
  describe "validations" do
    it "requires a name" do
      tag = build(:transaction_tag, name: nil)
      expect(tag).not_to be_valid
    end

    it "requires a unique name per space" do
      space = create(:personal_space)
      create(:transaction_tag, space:, name: "Japan 2026")
      duplicate = build(:transaction_tag, space:, name: "Japan 2026")

      expect(duplicate).not_to be_valid
    end

    it "assigns a default color when blank" do
      tag = create(:transaction_tag, color: nil)

      expect(tag.color).to match(/\A#[0-9A-Fa-f]{6}\z/)
    end
  end
end
