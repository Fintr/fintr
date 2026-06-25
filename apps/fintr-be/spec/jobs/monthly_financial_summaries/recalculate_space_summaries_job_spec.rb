# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::RecalculateSpaceSummariesJob, type: :job do
  let(:space) { create(:space) }

  describe "concurrency controls" do
    it "limits concurrent executions to one per space" do
      expect(described_class.concurrency_limit).to eq(1)
      expect(described_class.concurrency_key.call(space_id: space.id)).to eq(
        "monthly_financial_summaries/recalculate_space/#{space.id}"
      )
    end
  end

  describe "#perform" do
      it "delegates to RecalculateSpaceSummaries" do
        operation = instance_double(MonthlyFinancialSummaries::Operations::RecalculateSpaceSummaries)
        allow(MonthlyFinancialSummaries::Operations::RecalculateSpaceSummaries).to receive(:new)
          .and_return(operation)
        allow(operation).to receive(:call).with(space_id: space.id).and_return(
          Dry::Monads::Success(
            currency: "SSP",
            months_recalculated: 12
          )
        )

        described_class.perform_now(space_id: space.id)

        expect(operation).to have_received(:call).with(space_id: space.id)
      end
  end
end
