# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::UpdateSpace, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "PHP") }

  before do
    user.add_role(:admin, space)
  end

  describe "#call" do
    subject(:result) do
      operation.call(
        user_id: user.id.to_s,
        space_id: space.id.to_s,
        name: space.name,
        **extra_params
      )
    end

    let(:extra_params) { {} }

    context "when only the name changes" do
      let(:extra_params) { { name: "Renamed space" } }

      it "does not enqueue monthly summary recalculation" do
        expect do
          expect(result).to be_success
        end.not_to have_enqueued_job(MonthlyFinancialSummaries::RecalculateSpaceSummariesJob)
      end
    end

    context "when the space currency changes" do
      let(:extra_params) { { name: space.name, currency: "SSP" } }

      it "enqueues monthly summary recalculation after the update commits" do
        expect do
          expect(result).to be_success
          expect(result.value!.currency).to eq("SSP")
        end.to have_enqueued_job(MonthlyFinancialSummaries::RecalculateSpaceSummariesJob)
          .with(space_id: space.id.to_s)
      end
    end

    context "when the currency param matches the existing currency" do
      let(:extra_params) { { name: space.name, currency: "PHP" } }

      it "does not enqueue monthly summary recalculation" do
        expect do
          expect(result).to be_success
        end.not_to have_enqueued_job(MonthlyFinancialSummaries::RecalculateSpaceSummariesJob)
      end
    end
  end
end
