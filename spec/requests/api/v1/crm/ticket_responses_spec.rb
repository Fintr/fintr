# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Crm::TicketResponses', type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:auth) { setup_authentication(user: user, space: space) }
  let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

  let!(:ticket) { create(:crm_ticket, user: user, space: space) }

  describe 'POST /api/v1/crm/tickets/:ticket_id/responses' do
    let(:valid_params) { { message: 'This is a test response' } }

    context 'when ticket belongs to user' do
      let(:mock_operation) { instance_double(Crm::Operations::CreateTicketResponse) }

      context 'when response creation is successful' do
        let(:created_response) { build(:crm_ticket_response, message: 'This is a test response') }

        before do
          allow(Crm::Operations::CreateTicketResponse).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Success.new(created_response)
          )
        end

        it 'creates a new response successfully' do
          post "/api/v1/crm/tickets/#{ticket.id}/responses",
               params: valid_params,
               headers: headers

          expect(response).to have_http_status(:created)
          expect(response.content_type).to include('application/json')
        end

        it 'calls CreateTicketResponse operation with correct parameters' do
          post "/api/v1/crm/tickets/#{ticket.id}/responses",
               params: valid_params,
               headers: headers

          expect(mock_operation).to have_received(:call) do |params|
            expect(params[:ticket_id]).to eq(ticket.id)
            expect(params[:message]).to eq('This is a test response')
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

          post "/api/v1/crm/tickets/#{ticket.id}/responses",
               params: params_with_images,
               headers: headers

          expect(mock_operation).to have_received(:call) do |params|
            expect(params[:images]).to be_present
            expect(params[:images]).to be_an(Array)
          end
        end

        it 'returns the created response data' do
          post "/api/v1/crm/tickets/#{ticket.id}/responses",
               params: valid_params,
               headers: headers

          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => true)
          expect(parsed_response['data']).to include('id' => created_response.id)
        end
      end

      context 'when response creation fails' do
        before do
          allow(Crm::Operations::CreateTicketResponse).to receive(:new).and_return(mock_operation)
          allow(mock_operation).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new({ message: ["can't be blank"] })
          )
        end

        it 'returns unprocessable entity with errors' do
          post "/api/v1/crm/tickets/#{ticket.id}/responses",
               params: { message: '' },
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
          parsed_response = JSON.parse(response.body)
          expect(parsed_response).to include('success' => false)
          expect(parsed_response['error']).to include('details')
        end
      end
    end

    context 'when ticket does not belong to user' do
      let(:other_user) { create(:user) }
      let(:other_ticket) { create(:crm_ticket, user: other_user, space: space) }

      it 'returns not found status' do
        post "/api/v1/crm/tickets/#{other_ticket.id}/responses",
             params: valid_params,
             headers: headers

        expect(response).to have_http_status(:not_found)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']['message']).to eq('Ticket not found')
      end
    end

    context 'when ticket does not exist' do
      it 'returns not found status' do
        post "/api/v1/crm/tickets/non-existent-id/responses",
             params: valid_params,
             headers: headers

        expect(response).to have_http_status(:not_found)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']['message']).to eq('Ticket not found')
      end
    end

    context 'when user is not authenticated' do
      it 'returns unauthorized status' do
        post "/api/v1/crm/tickets/#{ticket.id}/responses",
             params: valid_params

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when required parameters are missing' do
      it 'returns unprocessable entity when message is missing' do
        mock_operation = instance_double(Crm::Operations::CreateTicketResponse)
        allow(Crm::Operations::CreateTicketResponse).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new({ message: ["is missing"] })
        )

        post "/api/v1/crm/tickets/#{ticket.id}/responses",
             params: {},
             headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context 'when message is too long' do
      it 'returns unprocessable entity when message exceeds limit' do
        mock_operation = instance_double(Crm::Operations::CreateTicketResponse)
        allow(Crm::Operations::CreateTicketResponse).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new({ message: ["must be at most 1000 characters"] })
        )

        long_message = 'a' * 1001
        post "/api/v1/crm/tickets/#{ticket.id}/responses",
             params: { message: long_message },
             headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']['details']).to include('message')
      end
    end

    context 'when too many images are provided' do
      it 'returns unprocessable entity when image limit is exceeded' do
        mock_operation = instance_double(Crm::Operations::CreateTicketResponse)
        allow(Crm::Operations::CreateTicketResponse).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new({ images: ["cannot exceed 5 images"] })
        )

        images = Array.new(6) do
          Rack::Test::UploadedFile.new(
            StringIO.new("fake image content"),
            "image/jpeg",
            original_filename: "test_image.jpg"
          )
        end

        post "/api/v1/crm/tickets/#{ticket.id}/responses",
             params: { message: 'Test message', images: images },
             headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']['details']).to include('images')
      end
    end
  end
end
