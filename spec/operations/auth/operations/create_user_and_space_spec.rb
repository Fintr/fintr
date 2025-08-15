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

  # Mocks setup
  before do
    allow(Auth::User).to receive(:clean_attributes).and_return([:email, :full_name, :auth_id, :photo_url])
    allow(Utils::Name).to receive(:possessive).with(any_args).and_call_original
    allow(Utils::Name).to receive(:possessive).with("Test User").and_return("Test User's")
    allow(Utils::Name).to receive(:possessive).with("Old Name").and_return("Old Name's")
  end

  describe '#call' do
    subject(:call_operation) { operation.call(auth_params) }

    # Keep transaction test commented out for now
    # it 'wraps the creation process in a transaction' do ... end

    context 'when user and space do not exist' do
      let(:expected_space_code) { 'test-example-com-personal-space' }
      let(:expected_space_name) { "Test User's Space" }

      it { is_expected.to be_success }

      it 'returns the created user object' do
        result = call_operation
        expect(result.value!).to be_a(Auth::User)
        expect(result.value!.email).to eq(auth_params[:email])
      end

      it 'creates one user' do
        expect { call_operation }.to change(Auth::User, :count).by(1)
      end

      it 'creates one personal space' do
        expect { call_operation }.to change(Spaces::PersonalSpace, :count).by(1)
      end

      it 'creates one space user association' do
        expect { call_operation }.to change(Spaces::SpaceUser, :count).by(1)
      end

      context 'when after operation call' do
        let!(:user) { call_operation.value! }
        let!(:space) { user.spaces.find_by!(code: expected_space_code) }

        it 'sets the correct user attributes' do
          expect(user.reload.full_name).to eq(auth_params[:full_name])
          expect(user.reload.auth_id).to eq(auth_params[:auth_id])
          expect(user.reload.photo_url).to eq(auth_params[:photo_url])
        end

        it 'creates the space with correct attributes' do
          expect(space.name).to eq(expected_space_name)
          expect(space.currency).to eq('PHP')
          expect(space.type).to eq('Spaces::PersonalSpace')
        end

        it 'associates the user with the space' do
          expect(user.spaces).to include(space)
          expect(Spaces::SpaceUser.exists?(user_id: user.id, space_id: space.id)).to be true
        end

        it 'assigns the admin role to the user for the space' do
          expect(user.has_role?(:admin, space)).to be true
        end
      end
    end

    context 'when user and personal space already exist' do
      let!(:existing_user) { create(:user, auth_id: auth_params[:auth_id], email: auth_params[:email], full_name: 'Old Name') }
      let!(:existing_space) { create(:personal_space, code: 'test-example-com-personal-space', name: "Old Name's Space") }
      let!(:space_user_assoc) { create(:space_user, user: existing_user, space: existing_space) }

      it { is_expected.to be_success }

      it 'returns the existing user object' do
        expect(call_operation.value!).to eq(existing_user)
      end

      it 'does not create a new user' do
        expect { call_operation }.not_to change(Auth::User, :count)
      end

      it 'does not create a new space' do
        expect { call_operation }.not_to change(Spaces::PersonalSpace, :count)
      end

      it 'does not create a new space user association' do
        expect { call_operation }.not_to change(Spaces::SpaceUser, :count)
      end

      it 'updates the user attributes' do
        call_operation # Run the operation
        existing_user.reload
        expect(existing_user.full_name).to eq(auth_params[:full_name])
        expect(existing_user.auth_id).to eq(auth_params[:auth_id])
        expect(existing_user.photo_url).to eq(auth_params[:photo_url])
      end

      it 'assigns the admin role to the user for the space' do
        call_operation
        expect(existing_user.has_role?(:admin, existing_space)).to be true
      end
    end

    context 'when user saving fails validation' do
      let(:new_user) { build(:user, auth_params) }
      let(:user_errors) { ActiveModel::Errors.new(new_user).tap { |e| e.add(:email, :blank) } }
      let(:validation_exception) { ActiveRecord::RecordInvalid.new(new_user) }

      before do
        allow(Auth::User).to receive(:find_or_initialize_by).with(auth_id: auth_params[:auth_id]).and_return(new_user)
        allow(new_user).to receive(:changed?).and_return(true)
        allow(new_user).to receive(:save!).and_raise(validation_exception)
        allow(new_user).to receive(:errors).and_return(user_errors)
      end

      it { is_expected.to be_failure }

      it 'returns the validation errors in the failure' do
        expect(call_operation.failure[:errors]).to eq(user_errors)
      end

      it 'does not create a user' do
        expect { call_operation }.not_to change(Auth::User, :count)
      end

      it 'does not create a space' do
        expect { call_operation }.not_to change(Spaces::PersonalSpace, :count)
      end

      it 'does not create a space user association' do
        expect { call_operation }.not_to change(Spaces::SpaceUser, :count)
      end
    end

    context 'when space saving fails validation' do
      let(:user) { build(:user, auth_params) }
      let(:expected_space_code) { 'test-example-com-personal-space' }
      let(:new_space) { build(:personal_space, code: expected_space_code) }
      let(:space_errors) { ActiveModel::Errors.new(new_space).tap { |e| e.add(:name, :blank) } }
      let(:validation_exception) { ActiveRecord::RecordInvalid.new(new_space) }

      before do
        allow(Auth::User).to receive(:find_or_initialize_by).with(auth_id: auth_params[:auth_id]).and_return(user)
        allow(user).to receive(:changed?).and_return(true)
        allow(user).to receive(:save!).and_return(true)

        allow(Spaces::PersonalSpace).to receive(:find_or_initialize_by).with(code: expected_space_code).and_return(new_space)
        allow(new_space).to receive(:persisted?).and_return(false)
        allow(new_space).to receive(:assign_attributes)
        allow(new_space).to receive(:save!).and_raise(validation_exception)
        allow(new_space).to receive(:errors).and_return(space_errors)
      end

      it { is_expected.to be_failure }

      it 'returns the validation errors in the failure' do
        expect(call_operation.failure[:errors]).to eq(space_errors)
      end

      it 'might create the user but rolls back' do
         expect { call_operation }.not_to change(Auth::User, :count)
       end

      it 'does not create a space' do
        expect { call_operation }.not_to change(Spaces::PersonalSpace, :count)
      end

      it 'does not create a space user association' do
        expect { call_operation }.not_to change(Spaces::SpaceUser, :count)
      end
    end

    context 'when space_user saving fails validation' do
      let(:user) { build(:user, auth_params) }
      let(:space) { build(:personal_space, code: 'test-example-com-personal-space') }
      let(:new_space_user) { build(:space_user) }
      let(:space_user_errors) { ActiveModel::Errors.new(new_space_user).tap { |e| e.add(:base, 'some error') } }
      let(:validation_exception) { ActiveRecord::RecordInvalid.new(new_space_user) }

      before do
        allow(Auth::User).to receive(:find_or_initialize_by).with(auth_id: auth_params[:auth_id]).and_return(user)
        allow(user).to receive(:changed?).and_return(true)
        allow(user).to receive(:save!).and_return(true)

        allow(Spaces::PersonalSpace).to receive(:find_or_initialize_by).with(code: 'test-example-com-personal-space').and_return(space)
        allow(space).to receive(:persisted?).and_return(false)
        allow(space).to receive(:assign_attributes)
        allow(space).to receive(:save!).and_return(true)
        allow(space).to receive(:create_default_transaction_categories).and_return(true)

        allow(new_space_user).to receive(:user).and_return(user)
        allow(new_space_user).to receive(:space).and_return(space)
        allow(Spaces::SpaceUser).to receive(:find_or_initialize_by).with(user: user, space: space).and_return(new_space_user)
        allow(new_space_user).to receive(:persisted?).and_return(false)
        allow(new_space_user).to receive(:save!).and_raise(validation_exception)
        allow(new_space_user).to receive(:errors).and_return(space_user_errors)

        allow(user).to receive(:add_role)
      end

      it { is_expected.to be_failure }

      it 'returns the validation errors in the failure' do
        expect(call_operation.failure[:errors]).to eq(space_user_errors)
      end

      it 'rolls back user and space creation' do
        expect { call_operation }.not_to change(Auth::User, :count)
        expect { call_operation }.not_to change(Spaces::PersonalSpace, :count)
      end

      it 'does not create a space user association' do
        expect { call_operation }.not_to change(Spaces::SpaceUser, :count)
      end
    end
  end
end
