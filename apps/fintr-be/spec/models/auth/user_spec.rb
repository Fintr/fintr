# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Auth::User, type: :model do
  describe 'associations' do
    it { is_expected.to have_one(:onboarding).class_name("Onboarding").dependent(:destroy) }
    it { is_expected.to have_many(:transactions).class_name("Transactions::Transaction").dependent(:destroy) }
    it { is_expected.to have_many(:loans).class_name("Transactions::Loan").dependent(:destroy) }
    it { is_expected.to have_many(:tickets).class_name("Crm::Ticket").dependent(:destroy) }
    it { is_expected.to have_many(:space_users).class_name("Spaces::SpaceUser").dependent(:destroy) }
    it { is_expected.to have_many(:spaces).class_name("Spaces::Space").through(:space_users) }
    it { is_expected.to have_many(:personal_spaces).class_name("Spaces::PersonalSpace").through(:space_users) }
    it { is_expected.to have_many(:organization_spaces).class_name("Spaces::OrganizationSpace").through(:space_users) }
    it { is_expected.to have_many(:user_activities).dependent(:destroy) }
    it { is_expected.to have_many(:conversations).class_name("Ai::Conversation").dependent(:destroy) }
    it { is_expected.to have_many(:owned_spaces).class_name("Spaces::Space").with_foreign_key(:owner_id).dependent(:nullify) }
  end

  describe 'validations' do
    subject { build(:user) }

    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_uniqueness_of(:email).case_insensitive }

    describe 'email format validation' do
      subject { build(:user) }

      it { is_expected.to allow_value('user@example.com').for(:email) }
      it { is_expected.to allow_value('user.name@example.co.uk').for(:email) }
      it { is_expected.to allow_value('user+tag@example.com').for(:email) }
      it { is_expected.to allow_value('user-name@example.domain').for(:email) }

      it { is_expected.not_to allow_value('user@').for(:email) }
      it { is_expected.not_to allow_value('@example.com').for(:email) }
      it { is_expected.not_to allow_value('user name@example.com').for(:email) }
      it { is_expected.not_to allow_value('user@exam ple.com').for(:email) }

      it 'validates email with the URI::MailTo::EMAIL_REGEXP' do
        user = described_class.new(email: 'invalid-email')
        user.valid?
        expect(user.errors[:email]).to include('must be a valid email address')
      end
    end
  end

  describe 'callbacks' do
    describe 'before_validation :downcase_email' do
      it 'downcases email before validation' do
        user = build(:user, email: 'USER@EXAMPLE.COM')
        user.valid?
        expect(user.email).to eq('user@example.com')
      end

      it 'handles nil email gracefully' do
        user = build(:user, email: nil)
        user.valid?
        expect(user.email).to be_nil
      end

      it 'handles empty email gracefully' do
        user = build(:user, email: '')
        user.valid?
        expect(user.email).to eq('')
      end
    end

    describe 'after_create :create_onboarding' do
      it 'creates an onboarding record after user creation' do
        expect { create(:user) }.to change(Onboarding, :count).by(1)
      end

      it 'creates onboarding with correct attributes' do
        user = create(:user)
        onboarding = user.onboarding
        expect(onboarding).to be_present
        expect(onboarding.user).to eq(user)
        expect(onboarding.step).to eq('currency')
      end
    end
  end

  describe '.find_for_token' do
    let!(:user) { create(:user, auth_id: 'google-oauth2|1', email: 'u@example.com') }

    it 'prefers auth_id when the user exists with that auth_id' do
      result = described_class.find_for_token(auth_id: 'google-oauth2|1', email: 'other@example.com')

      expect(result[:user]).to eq(user)
      expect(result[:matched_by]).to eq(:auth_id)
    end

    it 'falls back to normalized email when auth_id is unknown' do
      result = described_class.find_for_token(auth_id: 'unknown|x', email: 'U@example.com')

      expect(result[:user]).to eq(user)
      expect(result[:matched_by]).to eq(:email)
    end

    it 'returns no user when neither auth_id nor email match' do
      result = described_class.find_for_token(auth_id: 'unknown|x', email: 'none@example.com')

      expect(result[:user]).to be_nil
      expect(result[:matched_by]).to be_nil
    end
  end
end
