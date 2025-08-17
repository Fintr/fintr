# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Crm::TicketResponse, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:ticket).class_name('Crm::Ticket') }
    it { is_expected.to belong_to(:responder).class_name('Auth::User').optional }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:message) }
    it { is_expected.to validate_length_of(:message).is_at_most(2000) }
    it { is_expected.to validate_presence_of(:response_type) }
  end

  describe 'enums' do
    describe 'response_type enum' do
      it 'defines the correct enum values' do
        expect(described_class.response_types).to eq({
          'user_reply' => 'user_reply',
          'admin_response' => 'admin_response',
          'system_update' => 'system_update'
        })
      end

      it 'provides enum query methods' do
        user_response = build(:crm_ticket_response, response_type: :user_reply)
        admin_response = build(:crm_ticket_response, response_type: :admin_response)
        system_response = build(:crm_ticket_response, response_type: :system_update)

        expect(user_response.user_reply?).to be true
        expect(user_response.admin_response?).to be false
        expect(user_response.system_update?).to be false

        expect(admin_response.admin_response?).to be true
        expect(admin_response.user_reply?).to be false
        expect(admin_response.system_update?).to be false

        expect(system_response.system_update?).to be true
        expect(system_response.user_reply?).to be false
        expect(system_response.admin_response?).to be false
      end
    end

    describe 'response_type scopes' do
      let!(:user_reply) { create(:crm_ticket_response, response_type: :user_reply) }
      let!(:admin_response) { create(:crm_ticket_response, response_type: :admin_response) }
      let!(:system_update) { create(:crm_ticket_response, response_type: :system_update) }

      describe '.user_replies' do
        it 'returns only user reply responses' do
          expect(described_class.user_replies).to include(user_reply)
          expect(described_class.user_replies).not_to include(admin_response, system_update)
        end
      end

      describe '.admin_responses' do
        it 'returns only admin responses' do
          expect(described_class.admin_responses).to include(admin_response)
          expect(described_class.admin_responses).not_to include(user_reply, system_update)
        end
      end
    end
  end

  describe 'scopes' do
    let(:ticket) { create(:crm_ticket) }
    let!(:older_response) { create(:crm_ticket_response, ticket: ticket, created_at: 2.days.ago) }
    let!(:newer_response) { create(:crm_ticket_response, ticket: ticket, created_at: 1.day.ago) }

    describe '.chronological' do
      it 'returns responses ordered by creation date ascending' do
        expect(described_class.chronological).to eq([older_response, newer_response])
      end
    end
  end

  describe 'image attachments' do
    let(:ticket_response) { build(:crm_ticket_response) }

    describe 'attachment validation' do
      context 'when attaching valid images' do
        it 'allows JPEG images' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.jpg'), 'image/jpeg')
          ticket_response.images.attach(file)
          expect(ticket_response).to be_valid
        end

        it 'allows PNG images' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.png'), 'image/png')
          ticket_response.images.attach(file)
          expect(ticket_response).to be_valid
        end

        it 'allows WebP images' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.webp'), 'image/webp')
          ticket_response.images.attach(file)
          expect(ticket_response).to be_valid
        end

        it 'allows up to 5 images' do
          5.times do |i|
            file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.jpg'), 'image/jpeg')
            ticket_response.images.attach(io: file, filename: "test#{i}.jpg", content_type: 'image/jpeg')
          end
          expect(ticket_response).to be_valid
        end
      end

      context 'when attaching invalid images' do
        it 'rejects non-image files' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.txt'), 'text/plain')
          ticket_response.images.attach(file)
          expect(ticket_response).to be_invalid
          expect(ticket_response.errors[:images]).to include('must be JPEG, PNG, or WebP format')
        end

        it 'rejects more than 5 images' do
          6.times do |i|
            file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.jpg'), 'image/jpeg')
            ticket_response.images.attach(io: file, filename: "test#{i}.jpg", content_type: 'image/jpeg')
          end
          expect(ticket_response).to be_invalid
          expect(ticket_response.errors[:images]).to include('cannot exceed 5 images per response')
        end

        it 'rejects images larger than 10MB' do
          ticket_response.save! # Need to save first to attach files

          # Create a file attachment
          large_file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.jpg'), 'image/jpeg')
          ticket_response.images.attach(large_file)

          # Mock the byte_size on the attached blob
          allow(ticket_response.images.first.blob).to receive(:byte_size).and_return(11.megabytes)

          ticket_response.valid?
          expect(ticket_response.errors[:images]).to include('must be less than 10MB each')
        end
      end
    end
  end

  describe 'helper methods' do
    describe '#from_admin?' do
      it 'returns true for admin_response type' do
        ticket_response = build(:crm_ticket_response, response_type: :admin_response)
        expect(ticket_response.from_admin?).to be true
      end

      it 'returns false for user_reply type' do
        ticket_response = build(:crm_ticket_response, response_type: :user_reply)
        expect(ticket_response.from_admin?).to be false
      end

      it 'returns false for system_update type' do
        ticket_response = build(:crm_ticket_response, response_type: :system_update)
        expect(ticket_response.from_admin?).to be false
      end
    end

    describe '#from_user?' do
      it 'returns true for user_reply type' do
        ticket_response = build(:crm_ticket_response, response_type: :user_reply)
        expect(ticket_response.from_user?).to be true
      end

      it 'returns false for admin_response type' do
        ticket_response = build(:crm_ticket_response, response_type: :admin_response)
        expect(ticket_response.from_user?).to be false
      end

      it 'returns false for system_update type' do
        ticket_response = build(:crm_ticket_response, response_type: :system_update)
        expect(ticket_response.from_user?).to be false
      end
    end
  end

  describe 'factory' do
    it 'creates a valid ticket response' do
      ticket_response = build(:crm_ticket_response)
      expect(ticket_response).to be_valid
    end

    it 'creates a ticket response with all required associations' do
      ticket_response = create(:crm_ticket_response)
      expect(ticket_response.ticket).to be_present
      expect(ticket_response.responder).to be_present
      expect(ticket_response.message).to be_present
      expect(ticket_response.response_type).to be_present
    end

    context 'with different response types' do
      it 'creates a user_reply response' do
        ticket_response = create(:crm_ticket_response, response_type: :user_reply)
        expect(ticket_response).to be_user_reply
      end

      it 'creates an admin_response response' do
        ticket_response = create(:crm_ticket_response, response_type: :admin_response)
        expect(ticket_response).to be_admin_response
      end

      it 'creates a system_update response' do
        ticket_response = create(:crm_ticket_response, response_type: :system_update)
        expect(ticket_response).to be_system_update
      end
    end
  end
end
