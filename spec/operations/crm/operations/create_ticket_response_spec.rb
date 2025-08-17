# frozen_string_literal: true

require "rails_helper"

RSpec.describe Crm::Operations::CreateTicketResponse do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:ticket) { create(:crm_ticket, user: user, space: space) }

  let(:valid_params) do
    {
      user_id: user.id,
      ticket_id: ticket.id,
      message: "User response message"
    }
  end

  describe "#call" do
    context "when all params are valid" do
      it "returns a successful result" do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it "returns the created response" do
        result = operation.call(valid_params)
        response = result.value!
        expect(response).to be_a(Crm::TicketResponse)
        expect(response.message).to eq("User response message")
        expect(response.responder_id).to eq(user.id)
        expect(response.response_type).to eq("user_reply")
        expect(response.ticket).to eq(ticket)
      end

      it "creates a new ticket response" do
        expect {
          operation.call(valid_params)
        }.to change(Crm::TicketResponse, :count).by(1)
      end

      it "persists the response to the database" do
        result = operation.call(valid_params)
        response = result.value!
        expect(response).to be_persisted
      end
    end

    context "when ticket is dismissed or resolved" do
      before do
        ticket.update!(status: "dismissed")
      end

      it "reopens the ticket to 'open' status" do
        operation.call(valid_params)
        expect(ticket.reload.status).to eq("open")
      end

      context "when ticket is resolved" do
        before do
          ticket.update!(status: "resolved")
        end

        it "reopens the ticket to 'open' status" do
          operation.call(valid_params)
          expect(ticket.reload.status).to eq("open")
        end
      end
    end

    context "when ticket status is already open or in_progress" do
      %w[open in_progress].each do |status|
        context "when ticket status is #{status}" do
          before do
            ticket.update!(status: status)
          end

          it "does not change the ticket status" do
            original_status = ticket.status
            operation.call(valid_params)
            expect(ticket.reload.status).to eq(original_status)
          end
        end
      end
    end

    context "with images" do
      let(:image_file) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:params_with_images) do
        valid_params.merge(images: [image_file])
      end

      it "attaches images to the response" do
        result = operation.call(params_with_images)
        response = result.value!
        expect(response.images).to be_attached
        expect(response.images.count).to eq(1)
      end
    end

    context "when user does not exist" do
      let(:invalid_params) do
        valid_params.merge(user_id: "non-existent-id")
      end

      it "returns a failure result" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: "User not found")
      end
    end

    context "when ticket does not exist or does not belong to user" do
      let(:other_user) { create(:user) }
      let(:other_ticket) { create(:crm_ticket, user: other_user) }
      let(:invalid_params) do
        valid_params.merge(ticket_id: other_ticket.id)
      end

      it "returns a failure result" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_id: "Ticket not found")
      end
    end
  end

  describe "#validate" do
    context "when valid params" do
      it "returns a successful result" do
        result = operation.send(:validate, valid_params)
        expect(result).to be_success
      end

      it "returns the validated params in hash" do
        result = operation.send(:validate, valid_params)
        expect(result.value!).to eq(valid_params)
      end
    end

    context "when invalid params" do
      it "returns a failure result when user_id is missing" do
        invalid_params = valid_params.except(:user_id)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end

      it "returns a failure result when user_id is empty" do
        invalid_params = valid_params.merge(user_id: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["must be filled"])
      end

      it "returns a failure result when ticket_id is missing" do
        invalid_params = valid_params.except(:ticket_id)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_id: ["is missing"])
      end

      it "returns a failure result when ticket_id is empty" do
        invalid_params = valid_params.merge(ticket_id: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_id: ["must be filled"])
      end

      it "returns a failure result when message is missing" do
        invalid_params = valid_params.except(:message)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(message: ["is missing"])
      end

      it "returns a failure result when message is empty" do
        invalid_params = valid_params.merge(message: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(message: ["must be filled"])
      end

      it "returns a failure result when message is too long" do
        invalid_params = valid_params.merge(message: "a" * 1001)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(message: ["must be at most 1000 characters"])
      end

      it "returns a failure result when too many images are provided" do
        images = Array.new(6) do
          Rack::Test::UploadedFile.new(
            StringIO.new("fake image content"),
            "image/jpeg",
            original_filename: "test_image.jpg"
          )
        end
        invalid_params = valid_params.merge(images: images)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(images: ["cannot exceed 5 images"])
      end
    end

    context "when optional params are not provided" do
      let(:minimal_params) do
        {
          user_id: user.id,
          ticket_id: ticket.id,
          message: "Test message"
        }
      end

      it "still validates successfully" do
        result = operation.send(:validate, minimal_params)
        expect(result).to be_success
      end
    end
  end

  describe "#find_user" do
    context "when user exists" do
      it "returns a successful result with the user" do
        result = operation.send(:find_user, valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(user)
      end
    end

    context "when user does not exist" do
      let(:params_with_invalid_user) do
        valid_params.merge(user_id: "non-existent-id")
      end

      it "returns a failure result" do
        result = operation.send(:find_user, params_with_invalid_user)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: "User not found")
      end
    end
  end

  describe "#find_ticket" do
    context "when ticket exists and belongs to user" do
      it "returns a successful result with the ticket" do
        result = operation.send(:find_ticket, user, valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(ticket)
      end
    end

    context "when ticket does not exist" do
      let(:params_with_invalid_ticket) do
        valid_params.merge(ticket_id: "non-existent-id")
      end

      it "returns a failure result" do
        result = operation.send(:find_ticket, user, params_with_invalid_ticket)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_id: "Ticket not found")
      end
    end

    context "when ticket exists but does not belong to user" do
      let(:other_user) { create(:user) }
      let(:other_ticket) { create(:crm_ticket, user: other_user) }
      let(:params_with_other_ticket) do
        valid_params.merge(ticket_id: other_ticket.id)
      end

      it "returns a failure result" do
        result = operation.send(:find_ticket, user, params_with_other_ticket)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_id: "Ticket not found")
      end
    end
  end

  describe "#build_response" do
    context "when building response without images" do
      it "builds a response with correct attributes" do
        result = operation.send(:build_response, ticket, valid_params)
        expect(result).to be_success

        response = result.value!
        expect(response).to be_a(Crm::TicketResponse)
        expect(response.message).to eq("User response message")
        expect(response.responder_id).to eq(user.id)
        expect(response.response_type).to eq("user_reply")
        expect(response.ticket).to eq(ticket)
        expect(response).not_to be_persisted
      end
    end

    context "when building response with images" do
      let(:image_file) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:params_with_images) do
        valid_params.merge(images: [image_file])
      end

      it "builds a response without attaching images yet" do
        result = operation.send(:build_response, ticket, params_with_images)
        response = result.value!
        expect(response).to be_a(Crm::TicketResponse)
        expect(response.message).to eq("User response message")
        expect(response.responder_id).to eq(user.id)
        expect(response.response_type).to eq("user_reply")
        expect(response.ticket).to eq(ticket)
        expect(response).not_to be_persisted
        # Images should not be attached during build phase
        expect(response.images).not_to be_attached
      end
    end
  end

  describe "#save_response" do
    let(:response) { ticket.ticket_responses.build(message: "Test", responder_id: user.id, response_type: "user_reply") }

    context "when response is valid" do
      it "saves the response successfully" do
        result = operation.send(:save_response, response)
        expect(result).to be_success
        expect(result.value!).to eq(response)
        expect(response).to be_persisted
      end
    end

    context "when response is invalid" do
      before do
        allow(response).to receive(:valid?).and_return(false)
        errors_double = instance_double(ActiveModel::Errors)
        allow(response).to receive(:errors).and_return(errors_double)
        allow(errors_double).to receive(:full_messages).and_return(["Message can't be blank"])
      end

      it "returns a failure result with validation errors" do
        result = operation.send(:save_response, response)
        expect(result).to be_failure
        expect(result.failure).to eq(["Message can't be blank"])
      end
    end

    context "when a database error occurs" do
      before do
        allow(response).to receive(:save!).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:save_response, response)
        expect(result).to be_failure
        expect(result.failure).to include(error: "Database error")
        expect(Rails.logger).to have_received(:error).with("CreateTicketResponse error: Database error")
      end
    end
  end

  describe "#update_ticket_status" do
    context "when ticket is dismissed" do
      before do
        ticket.update!(status: "dismissed")
      end

      it "reopens the ticket to 'open' status" do
        result = operation.send(:update_ticket_status, ticket)
        expect(result).to be_success
        expect(ticket.reload.status).to eq("open")
      end
    end

    context "when ticket is resolved" do
      before do
        ticket.update!(status: "resolved")
      end

      it "reopens the ticket to 'open' status" do
        result = operation.send(:update_ticket_status, ticket)
        expect(result).to be_success
        expect(ticket.reload.status).to eq("open")
      end
    end

    context "when ticket is already open" do
      before do
        ticket.update!(status: "open")
      end

      it "does not change the ticket status" do
        original_status = ticket.status
        result = operation.send(:update_ticket_status, ticket)
        expect(result).to be_success
        expect(ticket.reload.status).to eq(original_status)
      end
    end

    context "when ticket is in_progress" do
      before do
        ticket.update!(status: "in_progress")
      end

      it "does not change the ticket status" do
        original_status = ticket.status
        result = operation.send(:update_ticket_status, ticket)
        expect(result).to be_success
        expect(ticket.reload.status).to eq(original_status)
      end
    end

    context "when a database error occurs during update" do
      before do
        ticket.update!(status: "resolved")
        allow(ticket).to receive(:update!).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:update_ticket_status, ticket)
        expect(result).to be_failure
        expect(result.failure).to include(error: "Database error")
        expect(Rails.logger).to have_received(:error).with("UpdateTicketStatus error: Database error")
      end
    end
  end

  describe "#attach_images" do
    let(:response) { create(:crm_ticket_response, ticket: ticket, responder: user) }

    context "when images are provided" do
      let(:image_file) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:params_with_images) do
        { images: [image_file] }
      end

      it "attaches images to the response" do
        expect(response.images).not_to be_attached

        result = operation.send(:attach_images, response, params_with_images)

        expect(result).to be_success
        expect(result.value!).to eq(response)
        expect(response.images).to be_attached
        expect(response.images.count).to eq(1)
      end

      it "attaches multiple images to the response" do
        image_file2 = Rack::Test::UploadedFile.new(
          StringIO.new("fake image content 2"),
          "image/png",
          original_filename: "test_image2.png"
        )
        params_with_multiple_images = { images: [image_file, image_file2] }

        result = operation.send(:attach_images, response, params_with_multiple_images)

        expect(result).to be_success
        expect(response.images).to be_attached
        expect(response.images.count).to eq(2)
      end
    end

    context "when images key is present but empty" do
      let(:params_with_empty_images) { { images: [] } }

      it "returns success without attaching any images" do
        result = operation.send(:attach_images, response, params_with_empty_images)

        expect(result).to be_success
        expect(result.value!).to eq(response)
        expect(response.images).not_to be_attached
      end
    end
  end
end
