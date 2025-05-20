# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Utils::Name do
  describe '.possessive' do
    context 'when the name ends with an \'s\' (lowercase)' do
      it "adds an apostrophe only" do
        expect(described_class.possessive('James')).to eq("James'")
      end
    end

    context 'when the name ends with an \'S\' (uppercase)' do
      it "adds an apostrophe only" do
        expect(described_class.possessive('CHRIS')).to eq("CHRIS'")
      end
    end

    context 'when the name does not end with an \'s\'' do
      it "adds an apostrophe and an s" do
        expect(described_class.possessive('John')).to eq("John's")
      end
    end

    context 'when the name is an empty string' do
      it "returns an empty string" do
        expect(described_class.possessive('')).to eq("")
      end
    end

    context 'when the name is nil' do
      it 'returns an empty string' do
        expect(described_class.possessive(nil)).to eq("")
      end
    end

    context "when the name is a single lowercase 's'" do
      it "adds an apostrophe only" do
        expect(described_class.possessive('s')).to eq("s'")
      end
    end

    context "when the name is a single uppercase 'S'" do
      it "adds an apostrophe only" do
        expect(described_class.possessive('S')).to eq("S'")
      end
    end

    context 'when the name has mixed case and ends with \'s\'' do
      it "adds an apostrophe only" do
        expect(described_class.possessive('Thomas')).to eq("Thomas'")
      end
    end

    context 'when the name has leading/trailing spaces but content ends with \'s\'' do
      it 'treats it as ending with \'s\' after stripping (current behavior is no strip)' do
        # The current implementation does not strip whitespace before checking.
        # So, "  James  " will become "  James  's"
        expect(described_class.possessive('  James  ')).to eq("  James  's")
      end
    end

    context 'when the name has leading/trailing spaces and content does not end with \'s\'' do
      it 'appends \'s (current behavior is no strip)' do
        expect(described_class.possessive('  John  ')).to eq("  John  's")
      end
    end
  end
end
