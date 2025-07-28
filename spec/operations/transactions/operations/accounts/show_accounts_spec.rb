# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'

RSpec.describe Transactions::Operations::Accounts::ShowAccounts do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) }
  let!(:space) { create(:space) }
  let(:valid_params) { { space_id: space.id.to_s } }

  let(:mock_accounts) { [build_stubbed(:account, space: space)] }
  let(:mock_serialized_accounts) { [{ id: mock_accounts.first.id, name: mock_accounts.first.name, balance: "100.00" }] }

  let(:mock_dashboard_accounts_query) { instance_double(Transactions::Queries::Accounts::DashboardAccounts) }
  let(:mock_dashboard_account_serializer) { class_double(Transactions::Serializers::Accounts::DashboardAccountSerializer) }

  before do
    allow(Transactions::Queries::Accounts::DashboardAccounts).to receive(:call).and_return(Dry::Monads::Success(mock_accounts))
    allow(Transactions::Serializers::Accounts::DashboardAccountSerializer).to receive(:render_as_hash).and_return(mock_serialized_accounts)
  end

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    let(:params) { valid_params }

    context 'with valid parameters' do
      it { is_expected.to be_success }

      it 'returns the aggregated accounts data' do
        result = call_operation.value!
        expect(result).to eq({ accounts: mock_serialized_accounts })
      end

      it 'calls DashboardAccounts query with correct parameters' do
        call_operation
        expect(Transactions::Queries::Accounts::DashboardAccounts).to have_received(:call).with(params: valid_params)
      end

      it 'calls DashboardAccountSerializer with retrieved accounts' do
        call_operation
        expect(Transactions::Serializers::Accounts::DashboardAccountSerializer).to have_received(:render_as_hash).with(mock_accounts)
      end
    end

    describe 'Validation Failures' do
      context 'when space_id is missing' do
        let(:params) { { some_other_param: "some_value" } }

        it { is_expected.to be_failure }

        it 'returns space_id missing error' do
          expect(call_operation.failure).to eq(space_id: ["is missing"])
        end
      end
    end

    describe 'Dependency Failures' do
      context 'when DashboardAccounts query fails' do
        let(:params) { valid_params }

        before do
          allow(Transactions::Queries::Accounts::DashboardAccounts).to receive(:call).and_return(Dry::Monads::Failure({ query: "Query failed" }))
        end


        it { is_expected.to be_failure }

        it 'returns the failure from DashboardAccounts' do
          expect(call_operation.failure[:query]).to include("Query failed")
        end
      end

      context 'when serialization fails (e.g., serializer receives unexpected data)' do
        let(:params) { valid_params }

        before do
          # Simulate an error within the serializer that might cause a failure or unexpected output
          allow(Transactions::Serializers::Accounts::DashboardAccountSerializer).to receive(:render_as_hash)
            .and_return(Dry::Monads::Failure(error: StandardError.new("Serialization error"), message: "Serialization failed"))
        end


        it { is_expected.to be_success } # The overall operation still succeeds, but contains a nested failure

        it 'contains a nested serialization failure' do
          result = call_operation.value!
          expect(result[:accounts]).to be_a(Dry::Monads::Failure)
          expect(result[:accounts].failure).to be_a(Hash)
          expect(result[:accounts].failure[:error]).to be_a(StandardError)
          expect(result[:accounts].failure[:error].message).to eq("Serialization error")
          expect(result[:accounts].failure[:message]).to eq("Serialization failed")
        end
      end
    end
  end
end
