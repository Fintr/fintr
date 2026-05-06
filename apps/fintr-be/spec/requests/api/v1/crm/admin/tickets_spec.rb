# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Crm::Admin::Tickets', type: :request do
  let(:space) { create(:space) }
  let(:admin_user) { create(:admin_user) }
  let(:regular_user) { create(:user) }
  let!(:auth) { setup_authentication(user: admin_user, space: space) }
  let(:headers) { auth[:headers] }

  let!(:ticket1) { create(:crm_ticket, title: "Bug Report", status: "open", priority: "high") }
  let!(:ticket2) { create(:crm_ticket, title: "Feature Request", status: "in_progress", priority: "medium") }

  describe 'GET /api/v1/crm/admin/tickets' do
    context 'when user is admin' do
      let(:mock_query) { instance_double(Crm::Queries::FilteredTickets) }
      let(:query_result) { double("query_result", current_page: 1, total_pages: 1, total_count: 2) } # rubocop:disable RSpec/VerifiedDoubles

      before do
        allow(Crm::Queries::FilteredTickets).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(query_result)
        )
        allow(Crm::Serializers::Admin::AdminTicketListSerializer).to receive(:render_as_hash).and_return([
          { id: ticket1.id, title: "Bug Report", status: "open" },
          { id: ticket2.id, title: "Feature Request", status: "in_progress" }
        ])
      end

      it 'returns a successful response' do
        get '/api/v1/crm/admin/tickets', headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
      end

      it 'calls FilteredTickets query with correct parameters' do
        get '/api/v1/crm/admin/tickets',
            params: { status: 'open', priority: 'high', page: 1 },
            headers: headers

        expect(Crm::Queries::FilteredTickets).to have_received(:call) do |args|
          expect(args[:relation]).to eq(Crm::Ticket.includes(:user, :ticket_responses))
          expect(args[:params]).to include(status: 'open', priority: 'high', page: '1')
        end
      end

      it 'returns paginated tickets data' do
        get '/api/v1/crm/admin/tickets', headers: headers

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include('success' => true)
        expect(parsed_response['data']).to include('tickets')
        expect(parsed_response['data']).to include('pagination')
      end

      context 'when query fails' do
        before do
          allow(Crm::Queries::FilteredTickets).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new("Database error")
          )
        end

        it 'returns internal server error' do
          get '/api/v1/crm/admin/tickets', headers: headers

          expect(response).to have_http_status(:internal_server_error)
        end
      end
    end

    context 'when user is not admin' do
      let!(:non_admin_auth) { setup_authentication(user: regular_user, space: space) }
      let(:non_admin_headers) { non_admin_auth[:headers] }

      it 'returns forbidden status' do
        get '/api/v1/crm/admin/tickets', headers: non_admin_headers

        expect(response).to have_http_status(:forbidden)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']['message']).to eq('Admin access required')
      end
    end
  end

  describe 'GET /api/v1/crm/admin/tickets/:id' do
    context 'when user is admin' do
      let(:serialized_ticket) do
        {
          id: ticket1.id,
          title: "Bug Report",
          description: "Test description",
          status: "open",
          priority: "high",
          responses: []
        }
      end

      before do
        allow(Crm::Serializers::Admin::AdminTicketDetailSerializer).to receive(:render_as_hash)
          .with(ticket1)
          .and_return(serialized_ticket)
      end

      it 'returns the ticket details' do
        get "/api/v1/crm/admin/tickets/#{ticket1.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include('success' => true)
        expect(parsed_response['data']).to include('id' => ticket1.id)
      end

      context 'when ticket does not exist' do
        it 'returns not found status' do
          get "/api/v1/crm/admin/tickets/non-existent-id", headers: headers

          expect(response).to have_http_status(:not_found)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response['error']['message']).to eq('Ticket not found')
        end
      end
    end

    context 'when user is not admin' do
      let!(:non_admin_auth) { setup_authentication(user: regular_user, space: space) }
      let(:non_admin_headers) { non_admin_auth[:headers] }

      it 'returns forbidden status' do
        get "/api/v1/crm/admin/tickets/#{ticket1.id}", headers: non_admin_headers

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'PATCH /api/v1/crm/admin/tickets/:id' do
    context 'when user is admin' do
      let(:mock_operation) { instance_double(Crm::Operations::Admin::UpdateTicketStatus) }
      let(:update_params) { { status: 'resolved', priority: 'low' } }

      context 'when update is successful' do
        before do
          allow(Crm::Operations::Admin::UpdateTicketStatus).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Success.new(ticket1)
          )
        end

        it 'updates the ticket successfully' do
          patch "/api/v1/crm/admin/tickets/#{ticket1.id}",
                params: update_params,
                headers: headers

          expect(response).to have_http_status(:ok)
          expect(response.content_type).to include('application/json')

          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => true)
          expect(parsed_response['message']).to eq('Ticket updated successfully')
          expect(parsed_response['data']).to include('id' => ticket1.id)
        end

        it 'calls UpdateTicketStatus operation with correct parameters' do
          patch "/api/v1/crm/admin/tickets/#{ticket1.id}",
                params: update_params,
                headers: headers

          expect(mock_operation).to have_received(:call) do |params|
            expect(params[:id]).to eq(ticket1.id)
            expect(params[:status]).to eq('resolved')
            expect(params[:priority]).to eq('low')
            expect(params[:user_id]).to eq(admin_user.id)
          end
        end
      end

      context 'when update fails' do
        before do
          allow(Crm::Operations::Admin::UpdateTicketStatus).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ status: ["invalid status"] })
          )
        end

        it 'returns unprocessable entity with errors' do
          patch "/api/v1/crm/admin/tickets/#{ticket1.id}",
                params: { status: 'invalid_status' },
                headers: headers

          expect(response).to have_http_status(:unprocessable_content)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']).to include('details')
        end
      end

      context 'when ticket does not exist' do
        it 'returns not found status' do
          patch "/api/v1/crm/admin/tickets/non-existent-id",
                params: update_params,
                headers: headers

          expect(response).to have_http_status(:not_found)
        end
      end
    end

    context 'when user is not admin' do
      let!(:non_admin_auth) { setup_authentication(user: regular_user, space: space) }
      let(:non_admin_headers) { non_admin_auth[:headers] }

      it 'returns forbidden status' do
        patch "/api/v1/crm/admin/tickets/#{ticket1.id}",
              params: { status: 'resolved' },
              headers: non_admin_headers

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'POST /api/v1/crm/admin/tickets/:id/respond' do
    context 'when user is admin' do
      let(:mock_operation) { instance_double(Crm::Operations::Admin::CreateAdminResponse) }
      let(:response_params) { { message: 'This is an admin response' } }

      context 'when response creation is successful' do
        let(:created_response) { build(:crm_ticket_response, message: 'This is an admin response') }

        before do
          allow(Crm::Operations::Admin::CreateAdminResponse).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Success.new(created_response)
          )
        end

        it 'creates admin response successfully' do
          post "/api/v1/crm/admin/tickets/#{ticket1.id}/respond",
               params: response_params,
               headers: headers

          expect(response).to have_http_status(:created)
          expect(response.content_type).to include('application/json')

          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => true)
        end

        it 'calls CreateAdminResponse operation with correct parameters' do
          post "/api/v1/crm/admin/tickets/#{ticket1.id}/respond",
               params: response_params,
               headers: headers

          expect(mock_operation).to have_received(:call) do |params|
            expect(params[:ticket_id]).to eq(ticket1.id)
            expect(params[:message]).to eq('This is an admin response')
            expect(params[:user_id]).to eq(admin_user.id)
          end
        end
      end

      context 'when response creation fails' do
        before do
          allow(Crm::Operations::Admin::CreateAdminResponse).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ message: ["can't be blank"] })
          )
        end

        it 'returns unprocessable entity with errors' do
          post "/api/v1/crm/admin/tickets/#{ticket1.id}/respond",
               params: { message: '' },
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']).to include('details')
        end
      end
    end

    context 'when user is not admin' do
      let!(:non_admin_auth) { setup_authentication(user: regular_user, space: space) }
      let(:non_admin_headers) { non_admin_auth[:headers] }

      it 'returns forbidden status' do
        post "/api/v1/crm/admin/tickets/#{ticket1.id}/respond",
             params: { message: 'Unauthorized response' },
             headers: non_admin_headers

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
