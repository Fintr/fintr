# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Tags::DeleteTag do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let!(:tag) { create(:transaction_tag, space:, name: "Japan 2026") }

  describe "#call" do
    context "when the tag has no assignments" do
      subject(:call_operation) do
        operation.call(id: tag.id, space_id: space.id)
      end

      it { is_expected.to be_success }

      it "deletes the tag" do
        expect { call_operation }.to change(Transactions::Tag, :count).by(-1)
      end
    end

    context "when the tag is assigned to transactions" do
      subject(:call_operation) do
        operation.call(id: tag.id, space_id: space.id)
      end

      let!(:tagged_transaction) { create(:transaction, space:) }

      before { tagged_transaction.tags << tag }

      it { is_expected.to be_success }

      it "deletes the tag" do
        expect { call_operation }.to change(Transactions::Tag, :count).by(-1)
      end

      it "deletes the tag assignments" do
        expect { call_operation }.to change(Transactions::TransactionTagging, :count).by(-1)
      end

      it "keeps the tagged transaction" do
        expect { call_operation }.not_to change(Transactions::Transaction, :count)
      end
    end

    context "when the tag is assigned to a recurring series" do
      subject(:call_operation) do
        operation.call(id: tag.id, space_id: space.id)
      end

      let(:user) { create(:user) }
      let(:account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
      let(:category) { create(:category, space:, category_type: "expense", name: "Fitness") }
      let(:parent) do
        Transactions::Operations::CreateTransaction.new.call(
          user_id: user.id,
          space_id: space.id,
          amount: 50.0,
          date: Date.current,
          description: "Weekly gym",
          transaction_type: "expense",
          category_name: category.name,
          account_name: account.name,
          schedule_type: "repeat",
          repeat_interval: "every_week",
          tag_ids: [tag.id],
        ).value!
      end

      it "removes the tag from every series occurrence" do
        series_ids = parent.series_records.map(&:id)
        call_operation

        expect(
          Transactions::TransactionTagging.where(transaction_id: series_ids).count,
        ).to eq(0)
      end
    end

    context "when the tag is not in the space" do
      subject(:call_operation) do
        operation.call(id: tag.id, space_id: create(:personal_space).id)
      end

      it { is_expected.to be_failure }
    end
  end
end
