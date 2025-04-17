# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Auth::Operations::CreateUserAndSpace do
  let(:operation) { described_class.new }

  let(:auth_params) do
    {
      email: 'test@example.com',
      full_name: 'Test User',
      auth_id: 'auth0|12345',
      photo_url: 'http://example.com/photo.jpg'
    }
  end

  # Mocks setup (assuming these helpers exist and work as mocked)
  before do
    allow(User).to receive(:clean_attributes).and_return([ :email, :full_name, :auth_id, :photo_url ])
    allow(Utils::Name).to receive(:possessive).with(any_args).and_call_original # Allow actual call for flexibility
    allow(Utils::Name).to receive(:possessive).with("Test User").and_return("Test User's")
    allow(Utils::Name).to receive(:possessive).with("Old Name").and_return("Old Name's") # For existing user context
  end

  describe '#call' do
    subject(:call_operation) { operation.call(auth_params) }

    context 'when user and space do not exist' do
      let(:expected_space_code) { 'test-example-com-personal-space' }
      let(:expected_space_name) { "Test User's Space" }

      # Test return value and success/failure
      it { is_expected.to be_success }

      it 'returns the created user object' do
        expect(call_operation.value!).to be_a(User)
        expect(call_operation.value!.email).to eq(auth_params[:email])
      end

      # Test database count changes
      it 'creates one user' do
        expect { call_operation }.to change(User, :count).by(1)
      end

      it 'creates one personal space' do
        expect { call_operation }.to change(Spaces::PersonalSpace, :count).by(1)
      end

      it 'creates one space user association' do
        expect { call_operation }.to change(SpaceUser, :count).by(1)
      end

      # Test state after creation
      context 'when after operation call' do
        # Run the operation once and get the resulting user
        let!(:user) { call_operation.value! }
        # Retrieve the space via the association created by the operation
        let!(:space) { user.spaces.find_by(code: expected_space_code) }

        it 'sets the correct user attributes' do
          expect(user.full_name).to eq(auth_params[:full_name])
          expect(user.auth_id).to eq(auth_params[:auth_id])
          expect(user.photo_url).to eq(auth_params[:photo_url])
        end

        it 'creates the space with correct attributes' do
          expect(space).not_to be_nil # Check association worked
          expect(space.name).to eq(expected_space_name)
          expect(space.currency).to eq('PHP')
          expect(space.type).to eq('Spaces::PersonalSpace')
        end

        it 'associates the user with the space' do
          expect(user.spaces).to include(space)
          expect(SpaceUser.exists?(user: user, space: space)).to be true
        end
      end
    end

    context 'when user and personal space already exist' do
      let!(:existing_user) { create(:user, email: auth_params[:email], full_name: 'Old Name') }
      let!(:existing_space) { create(:personal_space, code: 'test-example-com-personal-space', name: "Old Name's Space") }
      let!(:space_user_assoc) { create(:space_user, user: existing_user, space: existing_space) }

      # Test return value and success/failure
      it { is_expected.to be_success }

      it 'returns the existing user object' do
        expect(call_operation.value!).to eq(existing_user)
      end

      # Test database count changes
      it 'does not create a new user' do
        expect { call_operation }.not_to change(User, :count)
      end

      it 'does not create a new space' do
        expect { call_operation }.not_to change(Spaces::PersonalSpace, :count)
      end

      it 'does not create a new space user association' do
        expect { call_operation }.not_to change(SpaceUser, :count)
      end

      # Test state after update
      context 'when after operation call' do
        # Run the operation once and get the resulting (updated) user
        let!(:user) { call_operation.value! }
        # Use the let! defined space directly
        let(:space) { existing_space }

        it 'updates the user attributes' do
          user.reload # Ensure we have the latest attributes
          expect(user.full_name).to eq(auth_params[:full_name])
          expect(user.auth_id).to eq(auth_params[:auth_id])
          expect(user.photo_url).to eq(auth_params[:photo_url])
        end

        it 'ensures the user-space association still exists' do
          expect(user.spaces).to include(space)
          expect(SpaceUser.exists?(user: user, space: space)).to be true
        end
      end
    end
  end
end
