# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Crm::Tickets', type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:auth) { setup_authentication(user: user, space: space) }
  let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

  describe 'GET /api/v1/crm/tickets' do
    let(:mock_query) { instance_double(Crm::Queries::FilteredTickets) }
    let(:query_result) { double("query_result", current_page: 1, total_pages: 1, total_count: 2) } # rubocop:disable RSpec/VerifiedDoubles

    context 'when user is authenticated' do
      context 'when FilteredTickets query is successful' do
        before do
          allow(Crm::Queries::FilteredTickets).to receive(:call).and_return(
            Dry::Monads::Result::Success.new(query_result)
          )
          allow(Crm::Serializers::TicketListSerializer).to receive(:render_as_hash).and_return([
            { id: 1, title: "Bug Report", status: "open" },
            { id: 2, title: "Feature Request", status: "in_progress" }
          ])
        end

        it 'returns a successful response' do
          get '/api/v1/crm/tickets', headers: headers

          expect(response).to have_http_status(:ok)
          expect(response.content_type).to include('application/json')
        end

        it 'calls FilteredTickets query with correct parameters' do
          get '/api/v1/crm/tickets',
              params: { status: 'open', priority: 'high', page: 1 },
              headers: headers

          expect(Crm::Queries::FilteredTickets).to have_received(:call) do |args|
            expect(args[:relation].to_sql).to eq(space.tickets.where(user_id: user.id).to_sql)
            expect(args[:params]).to include(status: 'open', priority: 'high', page: '1')
          end
        end

        it 'returns paginated tickets data' do
          get '/api/v1/crm/tickets', headers: headers

          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => true)
          expect(parsed_response['data']).to include('tickets')
          expect(parsed_response['data']).to include('pagination')
        end

        it 'accepts filter parameters' do
          get '/api/v1/crm/tickets',
              params: {
                status: 'in_progress',
                ticket_type: 'feature_request',
                priority: 'medium',
                search_query: 'test',
                page: 2,
                per_page: 10
              },
              headers: headers

          expect(Crm::Queries::FilteredTickets).to have_received(:call) do |args|
            expect(args[:params]).to include(
              status: 'in_progress',
              ticket_type: 'feature_request',
              priority: 'medium',
              search_query: 'test',
              page: '2',
              per_page: '10'
            )
          end
        end
      end

      context 'when FilteredTickets query fails' do
        before do
          allow(Crm::Queries::FilteredTickets).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ base: ["Something went wrong"] })
          )
        end

        it 'returns internal server error with failure details' do
          get '/api/v1/crm/tickets', headers: headers

          expect(response).to have_http_status(:internal_server_error)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']).to include('details')
        end
      end

      context 'when tickets exist in different spaces' do
        let(:other_space) { create(:space) }
        let!(:current_space_ticket) { create(:crm_ticket, user: user, space: space, title: "Current Space Ticket") }
        let!(:other_space_ticket) { create(:crm_ticket, user: user, space: other_space, title: "Other Space Ticket") }
        let(:paginated_result) { double("paginated_result", current_page: 1, total_pages: 1, total_count: 1) } # rubocop:disable RSpec/VerifiedDoubles

        before do
          # Mock the query to return only tickets from current space
          allow(Crm::Queries::FilteredTickets).to receive(:call) do |args|
            # Verify the relation is scoped to current space
            if args[:relation].to_sql == space.tickets.where(user_id: user.id).to_sql
              Dry::Monads::Result::Success.new(paginated_result)
            else
              Dry::Monads::Result::Failure.new({ base: ["Invalid scope"] })
            end
          end

          allow(Crm::Serializers::TicketListSerializer).to receive(:render_as_hash).and_return([
            { id: current_space_ticket.id, title: "Current Space Ticket", status: "open" }
          ])
        end

        it 'only returns tickets from the current space (space isolation)' do
          get '/api/v1/crm/tickets', headers: headers

          expect(response).to have_http_status(:ok)
          expect(Crm::Queries::FilteredTickets).to have_received(:call) do |args|
            expect(args[:relation].to_sql).to eq(space.tickets.where(user_id: user.id).to_sql)
          end
        end
      end
    end

    context 'when user is not authenticated' do
      it 'returns unauthorized status' do
        get '/api/v1/crm/tickets', headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'GET /api/v1/crm/tickets/:id' do
    let!(:ticket) { create(:crm_ticket, user: user, space: space, title: "Test Ticket") }

    context 'when ticket belongs to user' do
      it 'returns a successful response' do
        get "/api/v1/crm/tickets/#{ticket.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
      end

      it 'returns the ticket details' do
        get "/api/v1/crm/tickets/#{ticket.id}", headers: headers

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include('success' => true)
        expect(parsed_response['data']).to include('id' => ticket.id)
      end

      it 'uses TicketDetailSerializer' do
        allow(Crm::Serializers::TicketDetailSerializer).to receive(:render_as_hash).and_return(
          { id: ticket.id, title: "Test Ticket", status: "open" }
        )

        get "/api/v1/crm/tickets/#{ticket.id}", headers: headers

        expect(Crm::Serializers::TicketDetailSerializer).to have_received(:render_as_hash).with(ticket)
      end
    end

    context 'when ticket does not exist' do
      it 'returns not found status' do
        get "/api/v1/crm/tickets/999999", headers: headers

        expect(response).to have_http_status(:not_found)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include('success' => false)
        expect(parsed_response['error']['message']).to eq("Ticket not found")
      end
    end

    context 'when ticket does not belong to user' do
      let(:other_user) { create(:user) }
      let!(:other_ticket) { create(:crm_ticket, user: other_user, space: space) }

      it 'returns not found status' do
        get "/api/v1/crm/tickets/#{other_ticket.id}", headers: headers

        expect(response).to have_http_status(:not_found)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include('success' => false)
        expect(parsed_response['error']['message']).to eq("Ticket not found")
      end
    end

    context 'when ticket belongs to user but in a different space' do
      let(:other_space) { create(:space) }
      let!(:other_space_ticket) { create(:crm_ticket, user: user, space: other_space) }

      it 'returns not found status (space isolation)' do
        get "/api/v1/crm/tickets/#{other_space_ticket.id}", headers: headers

        expect(response).to have_http_status(:not_found)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include('success' => false)
        expect(parsed_response['error']['message']).to eq("Ticket not found")
      end
    end

    context 'when user is not authenticated' do
      it 'returns unauthorized status' do
        get "/api/v1/crm/tickets/#{ticket.id}", headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/crm/tickets' do
    let(:valid_params) do
      {
        title: 'Bug in login form',
        description: 'The login form is not working properly',
        ticket_type: 'bug_report',
        priority: 'high'
      }
    end

    context 'when user is authenticated' do
      let(:mock_operation) { instance_double(Crm::Operations::CreateTicket) }

      context 'when ticket creation is successful' do
        let(:created_ticket) { build(:crm_ticket, title: 'Bug in login form', description: 'The login form is not working properly') }

        before do
          allow(Crm::Operations::CreateTicket).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Success.new(created_ticket)
          )
        end

        it 'creates a new ticket successfully' do
          post '/api/v1/crm/tickets',
               params: valid_params,
               headers: headers

          expect(response).to have_http_status(:created)
          expect(response.content_type).to include('application/json')
        end

        it 'calls CreateTicket operation with correct parameters' do
          post '/api/v1/crm/tickets',
               params: valid_params,
               headers: headers

          expect(mock_operation).to have_received(:call) do |params|
            expect(params[:title]).to eq('Bug in login form')
            expect(params[:description]).to eq('The login form is not working properly')
            expect(params[:ticket_type]).to eq('bug_report')
            expect(params[:priority]).to eq('high')
            expect(params[:user_id]).to eq(user.id)
            expect(params[:space_id]).to eq(space.id)
            expect(params[:space_code]).to eq(space.code)
          end
        end

        it 'handles image uploads' do
          image_file = Rack::Test::UploadedFile.new(
            StringIO.new("fake image content"),
            "image/jpeg",
            original_filename: "test_image.jpg"
          )
          params_with_images = valid_params.merge(images: [image_file])

          post '/api/v1/crm/tickets',
               params: params_with_images,
               headers: headers

          expect(mock_operation).to have_received(:call) do |params|
            expect(params[:images]).to be_present
            expect(params[:images]).to be_an(Array)
          end
        end

        it 'returns the created ticket data' do
          post '/api/v1/crm/tickets',
               params: valid_params,
               headers: headers

          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => true)
          expect(parsed_response['data']).to include('id' => created_ticket.id)
        end
      end

      context 'when ticket creation fails' do
        before do
          allow(Crm::Operations::CreateTicket).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ title: ["can't be blank"], description: ["can't be blank"] })
          )
        end

        it 'returns unprocessable entity with errors' do
          post '/api/v1/crm/tickets',
               params: { title: '', description: '' },
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']).to include('details')
        end
      end

      context 'when required parameters are missing' do
        before do
          allow(Crm::Operations::CreateTicket).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ title: ["can't be blank"] })
          )
        end

        it 'returns unprocessable entity when title is missing' do
          post '/api/v1/crm/tickets',
               params: { description: 'Some description' },
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']['details']).to include('title')
        end
      end

      context 'when too many images are provided' do
        before do
          allow(Crm::Operations::CreateTicket).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ images: ["Too many images provided"] })
          )
        end

        it 'returns unprocessable entity when image limit is exceeded' do
          image_files = Array.new(6) do |i|
            Rack::Test::UploadedFile.new(
              StringIO.new("fake image content #{i}"),
              "image/jpeg",
              original_filename: "test_image_#{i}.jpg"
            )
          end
          params_with_too_many_images = valid_params.merge(images: image_files)

          post '/api/v1/crm/tickets',
               params: params_with_too_many_images,
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']['details']).to include('images')
        end
      end
    end

    context 'when user is not authenticated' do
      it 'returns unauthorized status' do
        post '/api/v1/crm/tickets',
             params: valid_params,
             headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
