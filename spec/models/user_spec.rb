# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'associations' do
    it { is_expected.to have_many(:transactions).dependent(:destroy) }
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
end
