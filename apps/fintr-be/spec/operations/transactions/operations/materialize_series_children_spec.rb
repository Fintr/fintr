# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::MaterializeSeriesChildren do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:, balance: Money.from_amount(10_000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Gadgets") }

  describe "#call" do
    context "with an installment series missing future children" do
      subject(:call_operation) do
        operation.call(transaction_id: parent.id)
      end

      let(:schedule) do
        Utils::Recurrence.schedule(
          repeat_interval: :installment,
          date: Date.new(2026, 8, 18),
          installment_period: 12,
        ).to_hash
      end

      let!(:parent) do
        create(
          :expense_transaction,
          user:,
          space:,
          account:,
          category:,
          date: Date.new(2026, 8, 18),
          schedule_type: "installment",
          installment_period: 12,
          installment_count: 1,
          schedule:,
          amount: Money.from_amount(100, "PHP"),
        )
      end

      before do
        travel_to Date.new(2026, 8, 18)
      end

      it { is_expected.to be_success }

      it "creates the remaining installment children" do
        expect { call_operation }.to change(Transactions::Transaction, :count).by(11)
      end
    end

    context "when the installment root has an empty schedule hash" do
      subject(:call_operation) do
        operation.call(transaction_id: parent.id)
      end

      let!(:parent) do
        create(
          :expense_transaction,
          user:,
          space:,
          account:,
          category:,
          date: Date.new(2026, 3, 1),
          schedule_type: "installment",
          installment_period: 12,
          installment_count: 1,
          schedule: {},
          amount: Money.from_amount(100, "PHP"),
        )
      end

      before do
        travel_to Date.new(2026, 8, 22)
        create(
          :expense_transaction,
          user:,
          space:,
          account:,
          category:,
          date: Date.new(2026, 4, 1),
          schedule_type: "installment",
          installment_period: 12,
          installment_count: 2,
          parent_id: parent.id,
          amount: Money.from_amount(100, "PHP"),
        )
      end

      it { is_expected.to be_success }

      it "creates every missing payment through the term end" do
        expect { call_operation }.to change(Transactions::Transaction, :count).by(10)
      end

      it "returns the full installment series including existing rows" do
        records = call_operation.value!
        expect(records.map { |row| row.date.to_date }).to include(
          Date.new(2026, 3, 1),
          Date.new(2026, 4, 1),
          Date.new(2027, 2, 1),
        )
        expect(records.size).to eq(12)
      end
    end
  end
end
