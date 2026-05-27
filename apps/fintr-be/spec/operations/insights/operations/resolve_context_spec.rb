# frozen_string_literal: true

require "rails_helper"

RSpec.describe Insights::Operations::ResolveContext, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }

  let(:params) do
    {
      space_id: space.id,
      space_code: space.code,
      start_date: Date.new(2026, 5, 1),
      end_date: Date.new(2026, 5, 31)
    }
  end

  describe "#call" do
    subject(:result) { operation.call(params) }

    it { is_expected.to be_success }

    it "returns an ActiveRecord relation for transactions, not a monad" do
      value = result.value!
      expect(value[:transactions]).to be_a(ActiveRecord::Relation)
      expect(value[:prior_transactions]).to be_a(ActiveRecord::Relation)
    end
  end
end
