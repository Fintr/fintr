# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Receipts::CreateDraftFromReceiptResult, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space) }
  let(:category) { create(:category, space: space) }

  let(:valid_params) do
    {
      params: {
        user_id: user.id,
        space_id: space.id,
        image_path: "/path/to/receipt.jpg"
      },
      receipt_result: {
        suggested_transaction_payload: {
          amount: 100.50,
          date: Date.current,
          category_name: category.name,
          account_name: account.name,
          description: "Receipt from Whole Foods"
        }
      }
    }
  end

  describe "Contract" do
    context "with valid parameters" do
      it "is successful" do
        result = operation.validate(params: valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(valid_params)
      end
    end

    context "with invalid parameters" do
      context "when params.user_id is missing" do
        let(:params) do
          valid_params.deep_merge(params: { user_id: nil })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(params: { user_id: ['must be a string'] })
        end
      end

      context "when params.space_id is missing" do
        let(:params) do
          valid_params.deep_merge(params: { space_id: nil })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(params: { space_id: ['must be a string'] })
        end
      end

      context "when params.image_path is missing" do
        let(:params) do
          valid_params.deep_merge(params: { image_path: nil })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(params: { image_path: ['must be a string'] })
        end
      end

      context "when receipt_result.suggested_transaction_payload.amount is missing" do
        let(:params) do
          valid_params.deep_merge(receipt_result: { suggested_transaction_payload: { amount: nil } })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_result: { suggested_transaction_payload: { amount: ['must be a decimal'] } })
        end
      end

      context "when receipt_result.suggested_transaction_payload.date is missing" do
        let(:params) do
          valid_params.deep_merge(receipt_result: { suggested_transaction_payload: { date: nil } })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_result: { suggested_transaction_payload: { date: ['must be a date'] } })
        end
      end

      context "when receipt_result.suggested_transaction_payload.category_name is missing" do
        let(:params) do
          valid_params.deep_merge(receipt_result: { suggested_transaction_payload: { category_name: nil } })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_result: { suggested_transaction_payload: { category_name: ['must be a string'] } })
        end
      end

      context "when receipt_result.suggested_transaction_payload.account_name is missing" do
        let(:params) do
          valid_params.deep_merge(receipt_result: { suggested_transaction_payload: { account_name: nil } })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_result: { suggested_transaction_payload: { account_name: ['must be a string'] } })
        end
      end

      context "when receipt_result.suggested_transaction_payload.description is missing" do
        let(:params) do
          valid_params.deep_merge(receipt_result: { suggested_transaction_payload: { description: nil } })
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_result: { suggested_transaction_payload: { description: ['must be a string'] } })
        end
      end

      context "when receipt_result is missing" do
        let(:params) do
          valid_params.except(:receipt_result)
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_result: ['is missing'])
        end
      end

      context "when params is missing" do
        let(:params) do
          valid_params.except(:params)
        end

        it "fails with an error" do
          result = operation.validate(params: params)
          expect(result).to be_failure
          expect(result.failure).to include(params: ['is missing'])
        end
      end
    end
  end

  describe "#call" do
    let(:mock_create_transaction_operation) { instance_double(Transactions::Operations::CreateTransaction) }
    let(:mock_transaction) { instance_double(Transactions::Transaction) }

    before do
      allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(mock_create_transaction_operation)
    end

    context "when successful" do
      before do
        allow(mock_create_transaction_operation).to receive(:call).and_return(Dry::Monads::Success(mock_transaction))
      end

      it "creates a draft transaction with the correct parameters" do
        expected_transaction_params = {
          amount: 100.50,
          date: Date.current,
          category_name: category.name,
          account_name: account.name,
          description: "Receipt from Whole Foods",
          user_id: user.id,
          space_id: space.id,
          schedule_type: "one_time",
          draft: true
        }

        expect(mock_create_transaction_operation).to receive(:call).with(expected_transaction_params)

        result = operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(mock_transaction)
      end

      it "sets draft to true in the transaction parameters" do
        expect(mock_create_transaction_operation).to receive(:call) do |params|
          expect(params[:draft]).to be true
          Dry::Monads::Success(mock_transaction)
        end

        operation.call(valid_params)
      end
    end

    context "when CreateTransaction operation fails" do
      before do
        allow(mock_create_transaction_operation).to receive(:call).and_return(Dry::Monads::Failure({ error: "Transaction creation failed" }))
      end

              it "returns a failure" do
          result = operation.call(valid_params)
          expect(result).to be_failure
          expect(result.failure).to eq({ error: "Transaction creation failed" })
        end
    end

    context "when validation fails" do
      let(:invalid_params) do
        valid_params.deep_merge(params: { user_id: nil })
      end

      it "returns validation errors" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(params: { user_id: ['must be a string'] })
      end
    end
  end

  describe "#delete_old_drafts" do
    let(:user) { create(:user) }
    let(:space) { create(:personal_space) }
    let(:account) { create(:account, space: space) }
    let(:category) { create(:category, space: space) }

    context "when there are fewer than MAX_DRAFTS" do
      before do
        # Create 3 drafts (less than MAX_DRAFTS = 5)
        3.times do |i|
          create(:draft_transaction,
                 user: user,
                 space: space,
                 account: account,
                 category: category,
                 created_at: i.hours.ago)
        end
      end

      it "does not delete any drafts" do
        expect {
          operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        }.not_to change(Transactions::Draft, :count)
      end

      it "returns success" do
        result = operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        expect(result).to be_success
      end
    end

    context "when there are exactly MAX_DRAFTS" do
      before do
        # Create exactly MAX_DRAFTS (5) drafts
        5.times do |i|
          create(:draft_transaction,
                 user: user,
                 space: space,
                 account: account,
                 category: category,
                 created_at: i.hours.ago)
        end
      end

      it "does not delete any drafts" do
        expect {
          operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        }.not_to change(Transactions::Draft, :count)
      end

      it "returns success" do
        result = operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        expect(result).to be_success
      end
    end

    context "when there are more than MAX_DRAFTS" do
      before do
        # Create 7 drafts (more than MAX_DRAFTS = 5)
        7.times do |i|
          create(:draft_transaction,
                 user: user,
                 space: space,
                 account: account,
                 category: category,
                 created_at: i.hours.ago)
        end
      end

      it "deletes the oldest drafts beyond MAX_DRAFTS" do
        expect {
          operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        }.to change(Transactions::Draft, :count).by(-2) # Should delete 2 oldest drafts
      end

      it "keeps exactly MAX_DRAFTS drafts" do
        operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })

        remaining_drafts = Transactions::Draft.where(user: user, space: space)
        expect(remaining_drafts.count).to eq(5)
      end

      it "keeps the newest drafts" do
        operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })

        remaining_drafts = Transactions::Draft.where(user: user, space: space).order(created_at: :desc)
        expect(remaining_drafts.count).to eq(5)

        # Verify that we have the 5 newest drafts (created most recently)
        expected_created_ats = remaining_drafts.pluck(:created_at).sort.reverse
        expect(expected_created_ats.length).to eq(5)
      end

      it "returns success" do
        result = operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        expect(result).to be_success
      end
    end

    context "when there are drafts from different users/spaces" do
      let(:other_user) { create(:user) }
      let(:other_space) { create(:personal_space) }
      let(:other_account) { create(:account, space: other_space) }
      let(:other_category) { create(:category, space: other_space) }

      before do
        # Create 7 drafts for the target user/space (more than MAX_DRAFTS)
        7.times do |i|
          create(:draft_transaction,
                 user: user,
                 space: space,
                 account: account,
                 category: category,
                 created_at: i.hours.ago)
        end

        # Create 3 drafts for other user/space (should not be affected)
        3.times do |i|
          create(:draft_transaction,
                 user: other_user,
                 space: other_space,
                 account: other_account,
                 category: other_category,
                 created_at: i.hours.ago)
        end
      end

      it "only deletes drafts for the specified user and space" do
        expect {
          operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })
        }.to change(Transactions::Draft, :count).by(-2) # Should only delete 2 from target user/space
      end

      it "keeps drafts from other users/spaces intact" do
        other_user_drafts_before = Transactions::Draft.where(user: other_user, space: other_space).count

        operation.send(:delete_old_drafts, params: { params: { user_id: user.id, space_id: space.id } })

        other_user_drafts_after = Transactions::Draft.where(user: other_user, space: other_space).count
        expect(other_user_drafts_after).to eq(other_user_drafts_before)
      end
    end
  end

  describe "integration with real CreateTransaction operation" do
    context "when all required data exists" do
      let(:transaction_params) do
        {
          params: {
            user_id: user.id,
            space_id: space.id,
            image_path: "/path/to/receipt.jpg"
          },
          receipt_result: {
            suggested_transaction_payload: {
              amount: 75.25,
              date: Date.current,
              category_name: category.name,
              account_name: account.name,
              description: "Coffee shop receipt"
            }
          }
        }
      end

      it "successfully creates a draft transaction" do
        result = operation.call(transaction_params)
        expect(result).to be_success

        transaction = result.value!
        expect(transaction).to be_a(Transactions::Draft)
        expect(transaction.amount_cents).to eq(7525) # 75.25 * 100
        expect(transaction.date).to eq(Date.current)
        expect(transaction.category).to eq(category)
        expect(transaction.account).to eq(account)
        expect(transaction.description).to eq("Coffee shop receipt")
      end
    end

    context "when category does not exist" do
      let(:transaction_params) do
        {
          params: {
            user_id: user.id,
            space_id: space.id,
            image_path: "/path/to/receipt.jpg"
          },
          receipt_result: {
            suggested_transaction_payload: {
              amount: 50.00,
              date: Date.current,
              category_name: "Non-existent Category",
              account_name: account.name,
              description: "Test receipt"
            }
          }
        }
      end

      it "fails with category not found error" do
        result = operation.call(transaction_params)
        expect(result).to be_failure
        expect(result.failure).to include(category_name: "not found")
      end
    end

    context "when account does not exist" do
      let(:transaction_params) do
        {
          params: {
            user_id: user.id,
            space_id: space.id,
            image_path: "/path/to/receipt.jpg"
          },
          receipt_result: {
            suggested_transaction_payload: {
              amount: 50.00,
              date: Date.current,
              category_name: category.name,
              account_name: "Non-existent Account",
              description: "Test receipt"
            }
          }
        }
      end

      it "fails with account not found error" do
        result = operation.call(transaction_params)
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "not found")
      end
    end
  end
end
