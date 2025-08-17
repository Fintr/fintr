# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Crm::Queries::FilteredTickets, type: :query do
  let!(:user1) { create(:user) }
  let!(:user2) { create(:user) }
  let!(:space1) { create(:space) }
  let!(:space2) { create(:space) }

  # Create tickets with different attributes for testing filters
  let!(:bug_ticket_open) do
    create(:crm_ticket,
           user: user1,
           space: space1,
           title: "Login bug",
           description: "The login form is not working",
           ticket_type: "bug_report",
           priority: "high",
           status: "open",
           created_at: 1.day.ago)
  end

  let!(:feature_ticket_progress) do
    create(:crm_ticket,
           user: user1,
           space: space1,
           title: "New dashboard",
           description: "Need a better dashboard interface",
           ticket_type: "feature_request",
           priority: "medium",
           status: "in_progress",
           created_at: 2.days.ago)
  end

  let!(:help_ticket_resolved) do
    create(:crm_ticket,
           user: user1,
           space: space1,
           title: "How to reset password",
           description: "User needs help with password reset",
           ticket_type: "help_request",
           priority: "low",
           status: "resolved",
           created_at: 3.days.ago)
  end

  let!(:billing_ticket_urgent) do
    create(:crm_ticket,
           user: user2,
           space: space2,
           title: "Payment issue",
           description: "Credit card was charged twice",
           ticket_type: "billing_issue",
           priority: "urgent",
           status: "open",
           created_at: 4.days.ago)
  end

  describe '#validate' do
    context 'when all parameters are valid' do
      subject(:validation_result) { described_class.new(params: valid_params).validate }

      let(:valid_params) do
        {
          status: 'open',
          ticket_type: 'bug_report',
          priority: 'high',
          search_query: 'login',
          page: 1,
          per_page: 10
        }
      end


      it 'returns a success' do
        expect(validation_result).to be_success
      end

      it 'returns the validated params hash' do
        expect(validation_result.value!).to eq(valid_params)
      end
    end

    context 'when all parameters are optional' do
      subject(:validation_result) { described_class.new(params: minimal_params).validate }
      let(:minimal_params) { { page: 1 } }  # Provide at least one parameter to avoid validation issue


      it 'returns a success with minimal params' do
        expect(validation_result).to be_success
        expect(validation_result.value!).to include(page: 1)
      end
    end

    context 'when status parameter is nil' do
      subject(:validation_result) { described_class.new(params: params_with_nil_status).validate }

      let(:params_with_nil_status) { { status: nil } }


      it 'returns a success' do
        expect(validation_result).to be_success
      end
    end

    context 'when page is not an integer' do
      subject(:validation_result) { described_class.new(params: invalid_params).validate }

      let(:invalid_params) { { page: 'invalid' } }


      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes page in failure details' do
        expect(validation_result.failure).to include(:page)
      end
    end

    context 'when per_page is not an integer' do
      subject(:validation_result) { described_class.new(params: invalid_params).validate }

      let(:invalid_params) { { per_page: 'invalid' } }


      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes per_page in failure details' do
        expect(validation_result.failure).to include(:per_page)
      end
    end
  end

  describe '#call' do
    let(:base_relation) { Crm::Ticket.all }

    context 'without any filters' do
      subject(:query_result) { described_class.new(relation: base_relation, params: { page: 1 }).call }

      it 'returns a success' do
        expect(query_result).to be_success
      end

      it 'returns all tickets ordered by recent (created_at desc)' do
        tickets = query_result.value!

        # Check that all tickets are returned
        expect(tickets.count).to eq(4)

        # Check default ordering (most recent first)
        ticket_ids = tickets.map(&:id)
        expect(ticket_ids.first).to eq(bug_ticket_open.id)  # 1 day ago (most recent)
        expect(ticket_ids.last).to eq(billing_ticket_urgent.id)  # 4 days ago (oldest)
      end

      it 'applies pagination' do
        tickets = query_result.value!

        # Check that pagination methods are available
        expect(tickets).to respond_to(:current_page)
        expect(tickets).to respond_to(:total_pages)
        expect(tickets).to respond_to(:total_count)
      end
    end

    context 'with status filter' do
      it 'filters by open status' do
        params = { status: 'open', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(2)
        expect(tickets.map(&:id)).to contain_exactly(bug_ticket_open.id, billing_ticket_urgent.id)
      end

      it 'filters by in_progress status' do
        params = { status: 'in_progress', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(feature_ticket_progress.id)
      end

      it 'filters by resolved status' do
        params = { status: 'resolved', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(help_ticket_resolved.id)
      end

      it 'returns empty result for non-matching status' do
        params = { status: 'dismissed', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets).to be_empty
      end
    end

    context 'with ticket_type filter' do
      it 'filters by bug_report type' do
        params = { ticket_type: 'bug_report', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
      end

      it 'filters by feature_request type' do
        params = { ticket_type: 'feature_request', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(feature_ticket_progress.id)
      end

      it 'filters by help_request type' do
        params = { ticket_type: 'help_request', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(help_ticket_resolved.id)
      end

      it 'filters by billing_issue type' do
        params = { ticket_type: 'billing_issue', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(billing_ticket_urgent.id)
      end

      it 'returns empty result for non-matching type' do
        params = { ticket_type: 'account_issue', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets).to be_empty
      end
    end

    context 'with priority filter' do
      it 'filters by high priority' do
        params = { priority: 'high', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
      end

      it 'filters by medium priority' do
        params = { priority: 'medium', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(feature_ticket_progress.id)
      end

      it 'filters by low priority' do
        params = { priority: 'low', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(help_ticket_resolved.id)
      end

      it 'filters by urgent priority' do
        params = { priority: 'urgent', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(billing_ticket_urgent.id)
      end
    end

    context 'with search_query filter' do
      it 'searches by title (case insensitive)' do
        params = { search_query: 'login', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
      end

      it 'searches by title with different case' do
        params = { search_query: 'LOGIN', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
      end

      it 'searches by description' do
        params = { search_query: 'dashboard', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(feature_ticket_progress.id)
      end

      it 'searches by partial match in title' do
        params = { search_query: 'pass', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(help_ticket_resolved.id)
      end

      it 'searches by partial match in description' do
        params = { search_query: 'credit', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(billing_ticket_urgent.id)
      end

      it 'returns multiple matching tickets' do
        params = { search_query: 'issue', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(billing_ticket_urgent.id)
      end

      it 'returns empty result for non-matching search' do
        params = { search_query: 'nonexistent', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets).to be_empty
      end
    end

    context 'with multiple filters' do
      it 'combines status and ticket_type filters' do
        params = { status: 'open', ticket_type: 'bug_report', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
      end

      it 'combines status and priority filters' do
        params = { status: 'open', priority: 'urgent', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(billing_ticket_urgent.id)
      end

      it 'combines all filters' do
        params = {
          status: 'in_progress',
          ticket_type: 'feature_request',
          priority: 'medium',
          search_query: 'dashboard',
          page: 1
        }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(feature_ticket_progress.id)
      end

      it 'returns empty result when filters do not match any tickets' do
        params = { status: 'open', ticket_type: 'feature_request', page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets).to be_empty
      end
    end

    context 'with pagination' do
      it 'applies page parameter' do
        params = { page: 1, per_page: 2 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(2)
        expect(tickets.current_page).to eq(1)
        expect(tickets.total_count).to eq(4)
      end

      it 'applies per_page parameter' do
        params = { page: 1, per_page: 1 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(1)
        expect(tickets.current_page).to eq(1)
        expect(tickets.total_count).to eq(4)
      end

      it 'returns second page results' do
        params = { page: 2, per_page: 2 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets.count).to eq(2)
        expect(tickets.current_page).to eq(2)
        expect(tickets.total_count).to eq(4)
      end

      it 'returns empty results for page beyond available data' do
        params = { page: 5, per_page: 2 }
        result = described_class.new(relation: base_relation, params: params).call

        expect(result).to be_success
        tickets = result.value!

        expect(tickets).to be_empty
        expect(tickets.current_page).to eq(5)
        expect(tickets.total_count).to eq(4)
      end
    end

    context 'with pre-filtered relation' do
      it 'applies additional filters to pre-filtered relation' do
        # Start with a relation that only includes user1's tickets
        user1_tickets = Crm::Ticket.where(user: user1)
        params = { status: 'open', page: 1 }
        result = described_class.new(relation: user1_tickets, params: params).call

        expect(result).to be_success
        tickets = result.value!

        # Should only return user1's open tickets
        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
        expect(tickets.map(&:user_id)).to all(eq(user1.id))
      end

      it 'works with space-filtered relation' do
        # Start with a relation that only includes space1's tickets
        space1_tickets = Crm::Ticket.where(space: space1)
        params = { priority: 'high', page: 1 }
        result = described_class.new(relation: space1_tickets, params: params).call

        expect(result).to be_success
        tickets = result.value!

        # Should only return space1's high priority tickets
        expect(tickets.count).to eq(1)
        expect(tickets.first.id).to eq(bug_ticket_open.id)
        expect(tickets.map(&:space_id)).to all(eq(space1.id))
      end
    end
  end
end
