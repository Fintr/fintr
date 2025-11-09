# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::Accounts::FindOrCreateImportAccount, type: :operation do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }

  let(:valid_params) do
    {
      space_id: space.id.to_s
    }
  end

  describe "#call" do
    context "with invalid parameters" do
      context "when space_id is missing" do
        it "raises an ArgumentError when called with empty hash" do
          expect { operation.call({}) }.to raise_error(ArgumentError)
        end
      end

      context "when space_id is nil" do
        subject(:call_operation) { operation.call(space_id: nil) }

        it { is_expected.to be_failure }

        it "returns a failure with space_id missing error" do
          expect(call_operation.failure).to have_key(:space_id)
        end
      end
    end

    context "with valid parameters" do
      context "when space does not exist" do
        subject(:call_operation) { operation.call(space_id: SecureRandom.uuid) }

        it { is_expected.to be_failure }

        it "returns a failure with space not found error" do
          expect(call_operation.failure[:error]).to eq("Space not found")
        end
      end

      context "when account does not exist" do
        subject(:call_operation) { operation.call(valid_params) }

        it { is_expected.to be_success }

        it "creates a new account" do
          expect { call_operation }.to change(Transactions::Account, :count).by(1)
        end

        it "creates account with correct attributes" do
          result = call_operation.value!
          account = result
          expect(account).to be_a(Transactions::Account)
          expect(account.name).to eq("Import")
          expect(account.space_id).to eq(space.id)
          expect(account.balance_cents).to eq(0)
          expect(account.balance_currency).to eq("PHP")
          expect(account.account_category).to eq("cash")
        end

        it "returns the created account" do
          result = call_operation.value!
          expect(result).to be_a(Transactions::Account)
          expect(result.name).to eq("Import")
        end
      end

      context "when account already exists" do
        subject(:call_operation) { operation.call(valid_params) }

        let!(:existing_account) do
          create(
            :account,
            space: space,
            name: "Import",
            balance_cents: 0,
            balance_currency: "PHP",
            account_category: "cash"
          )
        end

        it { is_expected.to be_success }

        it "does not create a new account" do
          expect { call_operation }.not_to change(Transactions::Account, :count)
        end

        it "returns the existing account" do
          result = call_operation.value!
          expect(result.id).to eq(existing_account.id)
        end
      end

      context "when account exists in a different space" do
        subject(:call_operation) { operation.call(valid_params) }

        let(:other_space) { create(:personal_space) }
        let!(:other_space_account) do
          create(
            :account,
            space: other_space,
            name: "Import",
            balance_cents: 0,
            balance_currency: "PHP",
            account_category: "cash"
          )
        end

        it { is_expected.to be_success }

        it "creates a new account for the current space" do
          expect { call_operation }.to change(Transactions::Account, :count).by(1)
        end

        it "creates account with correct space_id" do
          result = call_operation.value!
          expect(result.space_id).to eq(space.id)
          expect(result.id).not_to eq(other_space_account.id)
        end
      end

      context "when handling race conditions" do
        context "when account is created between find and create" do
          subject(:call_operation) { operation.call(valid_params) }

          before do
            # Simulate race condition: first find returns nil, then create fails due to uniqueness
            allow(Transactions::Account).to receive(:find_by).and_return(nil, existing_account)
            allow(Transactions::Account).to receive(:create!).and_raise(
              ActiveRecord::RecordNotUnique.new("Duplicate entry")
            )
          end

          let!(:existing_account) do
            create(
              :account,
              space: space,
              name: "Import",
              balance_cents: 0,
              balance_currency: "PHP",
              account_category: "cash"
            )
          end

          it { is_expected.to be_success }

          it "returns the existing account" do
            result = call_operation.value!
            expect(result.id).to eq(existing_account.id)
          end
        end

        context "when account creation fails with RecordInvalid" do
          subject(:call_operation) { operation.call(valid_params) }

          before do
            allow(Transactions::Account).to receive(:find_by).and_return(nil)
            invalid_account = Transactions::Account.new
            invalid_account.errors.add(:name, "is invalid")
            allow(Transactions::Account).to receive(:create!).and_raise(
              ActiveRecord::RecordInvalid.new(invalid_account)
            )
            allow(Transactions::Account).to receive(:find_by!).and_raise(
              ActiveRecord::RecordNotFound.new("Account not found")
            )
          end

          it { is_expected.to be_failure }

          it "returns a failure with error message" do
            expect(call_operation.failure).to have_key(:error)
          end
        end

        context "when account is not found after creation attempt" do
          subject(:call_operation) { operation.call(valid_params) }

          before do
            allow(Transactions::Account).to receive(:find_by).and_return(nil)
            allow(Transactions::Account).to receive(:create!).and_raise(
              ActiveRecord::RecordNotUnique.new("Duplicate entry")
            )
            allow(Transactions::Account).to receive(:find_by!).and_raise(
              ActiveRecord::RecordNotFound.new("Account not found")
            )
          end

          it { is_expected.to be_failure }

          it "returns a failure with appropriate error message" do
            expect(call_operation.failure[:error]).to include("Import account not found after creation attempt")
          end
        end
      end
    end
  end
end
