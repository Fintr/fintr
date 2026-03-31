# frozen_string_literal: true

require "rails_helper"

RSpec.describe Integrations::Marketing::Brevo::ContactNameExtractor do
  describe ".call" do
    subject(:extract_names) { described_class.call(value:) }

    context "when value contains a comma" do
      let(:value) { "Dela Cruz, Juan Miguel" }

      it "extracts last name from before comma and first name from after comma" do
        expect(extract_names).to eq(
          first_name: "Juan Miguel",
          last_name: "Dela Cruz"
        )
      end
    end

    context "when value contains an at sign" do
      let(:value) { "test@example.com" }

      it "does not extract first or last name" do
        expect(extract_names).to eq(
          first_name: nil,
          last_name: nil
        )
      end
    end

    context "when value contains a parenthetical suffix with two words" do
      let(:value) { "First Second (Third Fourth)" }

      it "uses only the first two words outside parentheses" do
        expect(extract_names).to eq(
          first_name: "First",
          last_name: "Second"
        )
      end
    end

    context "when value contains a parenthetical suffix with one word" do
      let(:value) { "First Second (Third)" }

      it "uses only the first two words outside parentheses" do
        expect(extract_names).to eq(
          first_name: "First",
          last_name: "Second"
        )
      end
    end

    context "when value contains a parenthetical suffix after three names" do
      let(:value) { "First Second Third (Fourth Fifth)" }

      it "ignores parenthetical text and follows space-separated extraction" do
        expect(extract_names).to eq(
          first_name: "First Second",
          last_name: "Third"
        )
      end
    end

    context "when value is a normal three-part name" do
      let(:value) { "First Second Third" }

      it "uses first two names as first name and final part as last name" do
        expect(extract_names).to eq(
          first_name: "First Second",
          last_name: "Third"
        )
      end
    end

    context "when value is a normal two-part name" do
      let(:value) { "John Doe" }

      it "uses first part as first name and second part as last name" do
        expect(extract_names).to eq(
          first_name: "John",
          last_name: "Doe"
        )
      end
    end

    context "when value is a single-part name" do
      let(:value) { "Madonna" }

      it "uses single part as first name and leaves last name blank" do
        expect(extract_names).to eq(
          first_name: "Madonna",
          last_name: nil
        )
      end
    end
  end
end
