# frozen_string_literal: true

require "rails_helper"

RSpec.describe Admin::Queries::SpacesForFreeSubscriptionQuery, type: :query do
  describe "#call" do
    let(:owner_high) { create(:user, email: "high@example.com", full_name: "High Activity") }
    let(:owner_low) { create(:user, email: "low@example.com", full_name: "Low Activity") }
    let!(:space_high) do
      create(
        :personal_space,
        name: "High Tx Space",
        code: "high-tx-space",
        owner: owner_high,
      )
    end
    let!(:space_low) do
      create(
        :personal_space,
        name: "Low Tx Space",
        code: "low-tx-space",
        owner: owner_low,
      )
    end

    before do
      3.times do
        create(
          :transaction,
          space: space_high,
          user: owner_high,
        )
      end

      create(
        :transaction,
        space: space_low,
        user: owner_low,
      )
    end

    it "orders spaces by transaction count descending" do
      result = described_class.call(params: { page: 1, per_page: 25 })

      expect(result).to be_success
      ids = result.value!.map(&:id)
      expect(ids.first).to eq(space_high.id)
      expect(ids.second).to eq(space_low.id)
    end

    it "includes transaction counts on each space" do
      result = described_class.call(params: { page: 1, per_page: 25 })

      high = result.value!.find { |space| space.id == space_high.id }
      low = result.value!.find { |space| space.id == space_low.id }

      expect(high.read_attribute(:transactions_count)).to eq(3)
      expect(low.read_attribute(:transactions_count)).to eq(1)
    end

    it "paginates with a default of 25 per page" do
      extra_spaces = Array.new(26) do |index|
        create(:personal_space, name: "Extra #{index}", code: "extra-#{index}")
      end

      relation = ::Spaces::Space.where(
        id: [space_high.id, space_low.id] + extra_spaces.map(&:id),
      )

      page_one = described_class.call(relation:, params: { page: 1 })
      page_two = described_class.call(relation:, params: { page: 2 })

      expect(page_one.value!.size).to eq(25)
      expect(page_two.value!.size).to eq(3)
    end

    it "filters by search query across name, code, and owner" do
      result = described_class.call(
        params: {
          search_query: "high@example.com",
          page: 1,
          per_page: 25,
        },
      )

      expect(result.value!.map(&:id)).to eq([space_high.id])
    end
  end
end
