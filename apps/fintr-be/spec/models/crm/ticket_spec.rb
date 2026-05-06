# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Crm::Ticket, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name('Auth::User') }
    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
    it { is_expected.to have_many(:ticket_responses).dependent(:destroy) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:title) }
    it { is_expected.to validate_length_of(:title).is_at_most(255) }
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_length_of(:description).is_at_most(2000) }
    it { is_expected.to validate_presence_of(:ticket_type) }
    it { is_expected.to validate_presence_of(:priority) }
  end

  describe 'enums' do
    describe 'ticket_type enum' do
      it 'defines the correct enum values' do
        expect(described_class.ticket_types).to eq({
          'bug_report' => 'bug_report',
          'feature_request' => 'feature_request',
          'general_feedback' => 'general_feedback',
          'help_request' => 'help_request',
          'billing_issue' => 'billing_issue',
          'account_issue' => 'account_issue',
          'other' => 'other'
        })
      end

      it 'provides enum query methods' do
        bug_ticket = build(:crm_ticket, ticket_type: :bug_report)
        feature_ticket = build(:crm_ticket, ticket_type: :feature_request)
        feedback_ticket = build(:crm_ticket, ticket_type: :general_feedback)

        expect(bug_ticket.bug_report?).to be true
        expect(bug_ticket.feature_request?).to be false
        expect(feature_ticket.feature_request?).to be true
        expect(feature_ticket.bug_report?).to be false
        expect(feedback_ticket.general_feedback?).to be true
        expect(feedback_ticket.bug_report?).to be false
      end
    end

    describe 'priority enum' do
      it 'defines the correct enum values' do
        expect(described_class.priorities).to eq({
          'low' => 'low',
          'medium' => 'medium',
          'high' => 'high',
          'urgent' => 'urgent'
        })
      end

      it 'provides enum query methods' do
        low_ticket = build(:crm_ticket, priority: :low)
        urgent_ticket = build(:crm_ticket, priority: :urgent)

        expect(low_ticket.low?).to be true
        expect(low_ticket.urgent?).to be false
        expect(urgent_ticket.urgent?).to be true
        expect(urgent_ticket.low?).to be false
      end
    end

    describe 'status enum' do
      it 'defines the correct enum values' do
        expect(described_class.statuses).to eq({
          'open' => 'open',
          'in_progress' => 'in_progress',
          'resolved' => 'resolved',
          'dismissed' => 'dismissed'
        })
      end

      it 'provides enum query methods' do
        open_ticket = build(:crm_ticket, status: :open)
        resolved_ticket = build(:crm_ticket, status: :resolved)

        expect(open_ticket.open?).to be true
        expect(open_ticket.resolved?).to be false
        expect(resolved_ticket.resolved?).to be true
        expect(resolved_ticket.open?).to be false
      end
    end
  end

  describe 'scopes' do
    let!(:old_ticket) { create(:crm_ticket, created_at: 2.days.ago) }
    let!(:new_ticket) { create(:crm_ticket, created_at: 1.day.ago) }

    describe '.recent' do
      it 'returns tickets ordered by creation date descending' do
        expect(described_class.recent).to eq([new_ticket, old_ticket])
      end
    end

    describe '.by_status' do
      let!(:open_ticket) { create(:crm_ticket, status: :open) }
      let!(:resolved_ticket) { create(:crm_ticket, status: :resolved) }

      it 'filters tickets by status when status is provided' do
        expect(described_class.by_status('open')).to include(open_ticket)
        expect(described_class.by_status('open')).not_to include(resolved_ticket)
        expect(described_class.by_status('resolved')).to include(resolved_ticket)
        expect(described_class.by_status('resolved')).not_to include(open_ticket)
      end

      it 'returns all tickets when status is blank' do
        expect(described_class.by_status('')).to include(open_ticket, resolved_ticket)
        expect(described_class.by_status(nil)).to include(open_ticket, resolved_ticket)
      end
    end

    describe '.by_type' do
      let!(:bug_ticket) { create(:crm_ticket, ticket_type: :bug_report) }
      let!(:feature_ticket) { create(:crm_ticket, ticket_type: :feature_request) }

      it 'filters tickets by type when type is provided' do
        expect(described_class.by_type('bug_report')).to include(bug_ticket)
        expect(described_class.by_type('bug_report')).not_to include(feature_ticket)
        expect(described_class.by_type('feature_request')).to include(feature_ticket)
        expect(described_class.by_type('feature_request')).not_to include(bug_ticket)
      end

      it 'returns all tickets when type is blank' do
        expect(described_class.by_type('')).to include(bug_ticket, feature_ticket)
        expect(described_class.by_type(nil)).to include(bug_ticket, feature_ticket)
      end
    end

    describe '.by_priority' do
      let!(:low_ticket) { create(:crm_ticket, priority: :low) }
      let!(:urgent_ticket) { create(:crm_ticket, priority: :urgent) }

      it 'filters tickets by priority when priority is provided' do
        expect(described_class.by_priority('low')).to include(low_ticket)
        expect(described_class.by_priority('low')).not_to include(urgent_ticket)
        expect(described_class.by_priority('urgent')).to include(urgent_ticket)
        expect(described_class.by_priority('urgent')).not_to include(low_ticket)
      end

      it 'returns all tickets when priority is blank' do
        expect(described_class.by_priority('')).to include(low_ticket, urgent_ticket)
        expect(described_class.by_priority(nil)).to include(low_ticket, urgent_ticket)
      end
    end
  end

  describe 'image attachments' do
    let(:ticket) { build(:crm_ticket) }

    describe 'attachment validation' do
      context 'when attaching valid images' do
        it 'allows JPEG images' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.jpg'), 'image/jpeg')
          ticket.images.attach(file)
          expect(ticket).to be_valid
        end

        it 'allows PNG images' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.png'), 'image/png')
          ticket.images.attach(file)
          expect(ticket).to be_valid
        end

        it 'allows WebP images' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.webp'), 'image/webp')
          ticket.images.attach(file)
          expect(ticket).to be_valid
        end

        it 'allows GIF images' do
          # Create a GIF test file
          gif_content = "\x47\x49\x46\x38\x39\x61"
          File.write(Rails.root.join('spec/fixtures/files/test.gif'), gif_content)
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.gif'), 'image/gif')
          ticket.images.attach(file)
          expect(ticket).to be_valid
        end
      end

      context 'when attaching invalid images' do
        it 'rejects non-image files' do
          file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.txt'), 'text/plain')
          ticket.images.attach(file)
          expect(ticket).to be_invalid
          expect(ticket.errors[:images]).to include('must be a JPEG, PNG, GIF, or WebP image')
        end

        it 'rejects images larger than 10MB' do
          ticket.save! # Need to save first to attach files

          # Create a file attachment
          large_file = fixture_file_upload(Rails.root.join('spec/fixtures/files/test.jpg'), 'image/jpeg')
          ticket.images.attach(large_file)

          # Mock the byte_size on the attached blob
          allow(ticket.images.first.blob).to receive(:byte_size).and_return(11.megabytes)

          ticket.valid?
          expect(ticket.errors[:images]).to include('must be less than 10MB')
        end
      end
    end
  end

  describe 'instance methods' do
    let(:ticket) { create(:crm_ticket) }

    describe '#response_count' do
      it 'returns 0 when no responses exist' do
        expect(ticket.response_count).to eq(0)
      end

      it 'returns the correct count when responses exist' do
        create_list(:crm_ticket_response, 3, ticket: ticket)
        expect(ticket.response_count).to eq(3)
      end
    end

    describe '#latest_response' do
      it 'returns nil when no responses exist' do
        expect(ticket.latest_response).to be_nil
      end

      it 'returns the most recent response when multiple responses exist' do
        old_response = create(:crm_ticket_response, ticket: ticket, created_at: 2.days.ago)
        new_response = create(:crm_ticket_response, ticket: ticket, created_at: 1.day.ago)

        expect(ticket.latest_response).to eq(new_response)
        expect(ticket.latest_response).not_to eq(old_response)
      end
    end

    describe '#has_unread_responses?' do
      it 'returns nil when no responses exist' do
        expect(ticket.has_unread_responses?).to be_nil
      end

      it 'returns true when latest response is newer than ticket update' do
        ticket.update!(updated_at: 2.days.ago)
        create(:crm_ticket_response, ticket: ticket, created_at: 1.day.ago)

        expect(ticket.has_unread_responses?).to be true
      end

      it 'returns false when latest response is older than ticket update' do
        create(:crm_ticket_response, ticket: ticket, created_at: 2.days.ago)
        ticket.update!(updated_at: 1.day.ago)

        expect(ticket.has_unread_responses?).to be false
      end

      it 'returns false when latest response and ticket update are the same time' do
        time = 1.day.ago
        create(:crm_ticket_response, ticket: ticket, created_at: time)
        ticket.update!(updated_at: time)

        expect(ticket.has_unread_responses?).to be false
      end
    end
  end

  describe 'factory' do
    it 'creates a valid ticket' do
      ticket = build(:crm_ticket)
      expect(ticket).to be_valid
    end

    it 'creates a ticket with all required associations' do
      ticket = create(:crm_ticket)
      expect(ticket.user).to be_present
      expect(ticket.space).to be_present
      expect(ticket.title).to be_present
      expect(ticket.description).to be_present
      expect(ticket.ticket_type).to be_present
      expect(ticket.priority).to be_present
      expect(ticket.status).to be_present
    end

    context 'with different ticket types' do
      it 'creates a bug_report ticket' do
        ticket = create(:crm_ticket, ticket_type: :bug_report)
        expect(ticket).to be_bug_report
      end

      it 'creates a feature_request ticket' do
        ticket = create(:crm_ticket, ticket_type: :feature_request)
        expect(ticket).to be_feature_request
      end

      it 'creates a general_feedback ticket' do
        ticket = create(:crm_ticket, ticket_type: :general_feedback)
        expect(ticket).to be_general_feedback
      end
    end

    context 'with different priorities' do
      it 'creates a low priority ticket' do
        ticket = create(:crm_ticket, priority: :low)
        expect(ticket).to be_low
      end

      it 'creates an urgent priority ticket' do
        ticket = create(:crm_ticket, priority: :urgent)
        expect(ticket).to be_urgent
      end
    end

    context 'with different statuses' do
      it 'creates an open ticket' do
        ticket = create(:crm_ticket, status: :open)
        expect(ticket).to be_open
      end

      it 'creates a resolved ticket' do
        ticket = create(:crm_ticket, status: :resolved)
        expect(ticket).to be_resolved
      end
    end
  end
end
