# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::Operations::ShowEntity do
  subject(:operation) { described_class.new }

  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space:) }
  let(:category) { create(:category, space:, category_type: "expense") }
  let(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Jollibee") }

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      id: entity.id.to_s,
    }
  end

  describe "#call" do
    context "when entity exists" do
      let!(:expense) do
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category:,
          entity:,
          description: "Lunch",
        )
      end

      let!(:loan_entity) { create(:entity, space:, entity_type: "loan", full_name: "BPI") }
      let!(:loan) do
        create(
          :loan,
          space:,
          user:,
          account:,
          entity: loan_entity,
          description: "Car loan",
        )
      end

      it "returns the entity and related records" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payload = result.value!
        expect(payload[:entity]).to eq(entity)
        expect(payload[:transactions].map(&:id)).to eq([expense.id])
        expect(payload[:loans]).to eq([])
        expect(payload[:loan_payments]).to eq([])
      end
    end

    context "when entity is a loan contact" do
      let(:loan_entity) { create(:entity, space:, entity_type: "loan", full_name: "BPI") }
      let(:valid_params) do
        {
          space_id: space.id.to_s,
          id: loan_entity.id.to_s,
        }
      end

      let!(:loan) do
        create(
          :loan,
          space:,
          user:,
          account:,
          entity: loan_entity,
          description: "Car loan",
        )
      end

      let!(:loan_payment) do
        create(
          :loan_payment,
          loan:,
          account:,
        )
      end

      it "returns loans and loan payments" do
        result = operation.call(valid_params)

        expect(result).to be_success
        payload = result.value!
        expect(payload[:entity]).to eq(loan_entity)
        expect(payload[:transactions]).to eq([])
        expect(payload[:loans].map(&:id)).to eq([loan.id])
        expect(payload[:loan_payments].map(&:id)).to eq([loan_payment.id])
      end
    end

    context "when entity is not found" do
      it "returns failure" do
        result = operation.call(valid_params.merge(id: SecureRandom.uuid))

        expect(result).to be_failure
        expect(result.failure).to eq(id: "not found")
      end
    end
  end
end
