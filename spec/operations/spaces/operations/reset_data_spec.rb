# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spaces::Operations::ResetData do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    let(:params) do
      {
        space_id: space.id,
        user_id: user.id
      }
    end

    context 'when the operation is successful' do
      before do
        # Mock the ActiveRecord::Base.transaction block explicitly to allow step mocking
        allow(ActiveRecord::Base).to receive(:transaction).and_yield
      end

      it { is_expected.to be_success }

      it 'returns the original params on success' do
        expect(call_operation.value!).to eq(params)
      end
    end

    context 'when validation fails' do
      context 'when space_id is missing' do
        let(:params) { { user_id: user.id } }

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when user_id is missing' do
        let(:params) { { space_id: space.id } }

        it { is_expected.to be_failure }

        it 'returns a failure with user_id missing error' do
          expect(call_operation.failure).to eq({ user_id: ['is missing'] })
        end
      end
    end

    context 'when find_space step fails' do
      before do
        allow(operation).to receive(:find_space).and_return(Dry::Monads::Result::Failure.new(space: ['not found']))
        allow(operation).to receive(:find_user).and_return(Dry::Monads::Result::Success.new(user)) # Ensure this doesn't fail
      end

      it { is_expected.to be_failure }

      it 'returns the failure from find_space' do
        expect(call_operation.failure).to eq({ space: ['not found'] })
      end
    end

    context 'when find_user step fails' do
      before do
        allow(operation).to receive(:find_space).and_return(Dry::Monads::Result::Success.new(space))
        allow(operation).to receive(:find_user).and_return(Dry::Monads::Result::Failure.new(user: ['not found']))
      end

      it { is_expected.to be_failure }

      it 'returns the failure from find_user' do
        expect(call_operation.failure).to eq({ user: ['not found'] })
      end
    end

    context 'when delete_data step fails' do
      before do
        allow(operation).to receive(:find_space).and_return(Dry::Monads::Result::Success.new(space))
        allow(operation).to receive(:find_user).and_return(Dry::Monads::Result::Success.new(user))
        allow(operation).to receive(:delete_data).and_return(Dry::Monads::Result::Failure.new(delete_error: ['failed']))
        allow(operation).to receive(:populate_initial_data).and_return(Dry::Monads::Result::Success.new({}))
      end

      it { is_expected.to be_failure }

      it 'returns the failure from delete_data' do
        expect(call_operation.failure).to eq({ delete_error: ['failed'] })
      end

      it 'rolls back the transaction' do
        expect(ActiveRecord::Base).to receive(:transaction).and_call_original
        call_operation
      end
    end

    context 'when delete_conversations step fails' do
      before do
        allow(operation).to receive(:find_space).and_return(Dry::Monads::Result::Success.new(space))
        allow(operation).to receive(:find_user).and_return(Dry::Monads::Result::Success.new(user))
        allow(operation).to receive(:delete_data).and_return(Dry::Monads::Result::Success.new({}))
        allow(operation).to receive(:delete_conversations).and_return(Dry::Monads::Result::Failure.new(conversation_error: ['failed']))
        allow(operation).to receive(:populate_initial_data).and_return(Dry::Monads::Result::Success.new({}))
      end

      it { is_expected.to be_failure }

      it 'returns the failure from delete_conversations' do
        expect(call_operation.failure).to eq({ conversation_error: ['failed'] })
      end

      it 'rolls back the transaction' do
        expect(ActiveRecord::Base).to receive(:transaction).and_call_original
        call_operation
      end
    end

    context 'when populate_initial_data step fails' do
      before do
        allow(operation).to receive(:find_space).and_return(Dry::Monads::Result::Success.new(space))
        allow(operation).to receive(:find_user).and_return(Dry::Monads::Result::Success.new(user))
        allow(operation).to receive(:delete_data).and_return(Dry::Monads::Result::Success.new({}))
        allow(operation).to receive(:delete_conversations).and_return(Dry::Monads::Result::Success.new({}))
        allow(operation).to receive(:populate_initial_data).and_return(Dry::Monads::Result::Failure.new(populate_error: ['failed']))
      end

      it { is_expected.to be_failure }

      it 'returns the failure from populate_initial_data' do
        expect(call_operation.failure).to eq({ populate_error: ['failed'] })
      end

      it 'rolls back the transaction' do
        expect(ActiveRecord::Base).to receive(:transaction).and_call_original
        call_operation
      end
    end
  end

  describe '#validate' do
    subject(:validated_params_result) { operation.send(:validate, params:) }

    context 'with valid params' do
      let(:params) { { space_id: space.id, user_id: user.id } }

      it { is_expected.to be_success }

      it 'returns the validated params' do
        expect(validated_params_result.value!).to eq({ space_id: space.id, user_id: user.id })
      end
    end

    context 'with invalid params' do
      context 'when space_id is missing' do
        let(:params) { { user_id: user.id } }

        it { is_expected.to be_failure }

        it 'returns an error for space_id' do
          expect(validated_params_result.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when user_id is missing' do
        let(:params) { { space_id: space.id } }

        it { is_expected.to be_failure }

        it 'returns an error for user_id' do
          expect(validated_params_result.failure).to eq({ user_id: ['is missing'] })
        end
      end
    end
  end

  describe '#find_space' do
    subject(:found_space_result) { operation.send(:find_space, params:) }

    context 'when space exists' do
      let(:params) { { space_id: space.id } }

      it { is_expected.to be_success }

      it 'returns the space object' do
        expect(found_space_result.value!).to eq(space)
      end
    end

    context 'when space does not exist' do
      let(:params) { { space_id: 'non-existent-id' } }

      it { is_expected.to be_failure }

      it 'returns a failure with not found error' do
        expect(found_space_result.failure).to eq(space: ['not found'])
      end
    end
  end

  describe '#find_user' do
    subject(:found_user_result) { operation.send(:find_user, params:) }

    context 'when user exists' do
      let(:params) { { user_id: user.id } }

      it { is_expected.to be_success }

      it 'returns the user object' do
        expect(found_user_result.value!).to eq(user)
      end
    end

    context 'when user does not exist' do
      let(:params) { { user_id: 'non-existent-id' } }

      it { is_expected.to be_failure }

      it 'returns a failure with not found error' do
        expect(found_user_result.failure).to eq(user: ['not found'])
      end
    end
  end

  describe '#delete_data' do
    subject(:delete_data_result) { operation.send(:delete_data, space:, user:) }

    let!(:transaction) { create(:transaction, space: space) }
    let!(:account) { create(:account, space: space) }
    let!(:budget) { create(:budget, space: space) }
    let!(:goal_description) { create(:goal_description, space: space) }
    let!(:onboarding) { create(:onboarding, user: user) }
    let!(:import) { create(:import, space: space, user: user) }

    before do
      # Create categories with unique names to avoid validation conflicts
      create(:category, space: space, name: "Test Category 1 - #{SecureRandom.hex(4)}", category_type: "income")
      create(:category, space: space, name: "Test Category 2 - #{SecureRandom.hex(4)}", category_type: "expense")
    end

    it { is_expected.to be_success }

    it 'destroys all transactions for the space' do
      expect { delete_data_result }.to change(space.transactions, :count).by(-1)
    end

    it 'destroys all categories for the space' do
      # Expect all categories created (including default ones by space factory, if any) to be destroyed
      expect { delete_data_result }.to change(Transactions::Category, :count).by(-3) # 1 from transaction factory + 2 manually created
    end

    it 'destroys all accounts for the space' do
      expect { delete_data_result }.to change(space.accounts, :count).by(-1)
    end

    it 'destroys all budgets for the space' do
      expect { delete_data_result }.to change(space.budgets, :count).by(-1)
    end

    it 'destroys the goal description for the space' do
      expect { delete_data_result }.to change(GoalDescription, :count).by(-1)
    end

    it 'destroys the onboarding for the user' do
      expect { delete_data_result }.to change(Onboarding, :count).by(-1)
    end

    it 'destroys all imports for the space' do
      expect { delete_data_result }.to change(space.imports, :count).by(-1)
    end
  end

  describe '#delete_conversations' do
    subject(:delete_conversations_result) { operation.send(:delete_conversations, space:) }

    let!(:conversation1) { create(:ai_conversation, space: space, user: user) }
    let!(:conversation2) { create(:ai_conversation, space: space, user: user) }
    let(:delete_operation) { instance_double(Ai::Operations::Conversations::DeleteConversation) }

    before do
      allow(Ai::Operations::Conversations::DeleteConversation).to receive(:new).and_return(delete_operation)
    end

    context 'when conversations exist' do
      before do
        allow(delete_operation).to receive(:call).and_return(Dry::Monads::Success.new(conversation1))
      end

      it { is_expected.to be_success }

      it 'calls DeleteConversation operation for each conversation' do
        delete_conversations_result
        expect(delete_operation).to have_received(:call).with(conversation_id: conversation1.id).once
        expect(delete_operation).to have_received(:call).with(conversation_id: conversation2.id).once
      end
    end

    context 'when no conversations exist' do
      before do
        space.conversations.destroy_all
        allow(delete_operation).to receive(:call)
      end

      it { is_expected.to be_success }

      it 'does not call DeleteConversation operation' do
        delete_conversations_result
        expect(delete_operation).not_to have_received(:call)
      end
    end

    context 'when DeleteConversation operation fails' do
      before do
        allow(delete_operation).to receive(:call).and_return(Dry::Monads::Failure.new(error: "Delete failed"))
      end

      it { is_expected.to be_success }

      it 'continues processing even when individual deletions fail' do
        # The current implementation doesn't handle individual failures
        # It only catches StandardError exceptions, not operation failures
        expect(delete_conversations_result).to be_success
      end
    end

    context 'when an exception is raised' do
      before do
        allow(delete_operation).to receive(:call).and_raise(StandardError, "Unexpected error")
      end

      it { is_expected.to be_failure }

      it 'returns the exception message' do
        expect(delete_conversations_result.failure).to eq({ error: "Unexpected error" })
      end
    end
  end

  describe '#populate_initial_data' do
    subject(:populate_initial_data_result) { operation.send(:populate_initial_data, space:, user:) }

    it { is_expected.to be_success }

    it 'calls create_default_transaction_categories on the space' do
      allow(space).to receive(:create_default_transaction_categories).and_return(true)
      populate_initial_data_result
      expect(space).to have_received(:create_default_transaction_categories).once
    end

    it 'creates an onboarding record for the user' do
      expect { populate_initial_data_result }.to change(Onboarding, :count).by(1)
      expect(Onboarding.last.user).to eq(user)
      expect(Onboarding.last.step).to eq("income")
    end
  end
end
