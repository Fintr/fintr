# frozen_string_literal: true

require "rails_helper"

RSpec.describe Crm::Operations::Admin::CreateAdminResponse do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:ticket) { create(:crm_ticket) }

  let(:valid_params) do
    {
      ticket_id: ticket.id,
      message: "Admin response message",
      user_id: user.id
    }
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
    end
  end

  describe "#find_ticket" do
    context "when ticket exists" do
      it "returns a successful result with the ticket" do
        result = operation.send(:find_ticket, ticket.id)
        expect(result).to be_success
        expect(result.value!).to eq(ticket)
      end
    end

    context "when ticket does not exist" do
      it "returns a failure result" do
        result = operation.send(:find_ticket, "non-existent-id")
        expect(result).to be_failure
        expect(result.failure).to eq(["Ticket not found"])
      end
    end
  end

  describe "#create_response" do
    let(:message) { "Test admin response" }
    let(:response_params) { { message: message, user_id: user.id } }

    context "when response is valid" do
      it "creates a new ticket response" do
        expect {
          operation.send(:create_response, ticket, response_params)
        }.to change(Crm::TicketResponse, :count).by(1)
      end

      it "returns a successful result with the response" do
        result = operation.send(:create_response, ticket, response_params)
        expect(result).to be_success

        response = result.value!
        expect(response).to be_a(Crm::TicketResponse)
        expect(response.message).to eq(message)
        expect(response.responder_id).to eq(user.id)
        expect(response.response_type).to eq("admin_response")
        expect(response.ticket).to eq(ticket)
      end
    end

    context "when response is invalid" do
      let(:invalid_message) { "" }
      let(:invalid_params) { { message: invalid_message, user_id: user.id } }

      it "does not create a ticket response" do
        expect {
          operation.send(:create_response, ticket, invalid_params)
        }.not_to change(Crm::TicketResponse, :count)
      end

      it "returns a failure result with validation errors" do
        result = operation.send(:create_response, ticket, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include("Message can't be blank")
      end
    end

    context "when an error occurs during save" do
      before do
        allow_any_instance_of(Crm::TicketResponse).to receive(:save!).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:create_response, ticket, response_params)
        expect(result).to be_failure
        expect(result.failure).to include(error: "Database error")
        expect(Rails.logger).to have_received(:error).with("CreateAdminResponse error: Database error")
      end
    end
  end

  describe "#update_ticket_status" do
    context "when ticket is open" do
      let(:open_ticket) { create(:crm_ticket, status: "open") }

      it "updates the ticket status to in_progress" do
        expect {
          operation.send(:update_ticket_status, open_ticket)
        }.to change { open_ticket.reload.status }.from("open").to("in_progress")
      end

      it "returns a successful result with the ticket" do
        result = operation.send(:update_ticket_status, open_ticket)
        expect(result).to be_success
        expect(result.value!).to eq(open_ticket)
      end
    end

    context "when ticket is not open" do
      let(:in_progress_ticket) { create(:crm_ticket, status: "in_progress") }

      it "does not change the ticket status" do
        expect {
          operation.send(:update_ticket_status, in_progress_ticket)
        }.not_to change { in_progress_ticket.reload.status }
      end

      it "returns a successful result with the ticket" do
        result = operation.send(:update_ticket_status, in_progress_ticket)
        expect(result).to be_success
        expect(result.value!).to eq(in_progress_ticket)
      end
    end

    context "when an error occurs during update" do
      before do
        allow(ticket).to receive(:update!).and_raise(StandardError.new("Update error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:update_ticket_status, ticket)
        expect(result).to be_failure
        expect(result.failure).to include(error: "Update error")
        expect(Rails.logger).to have_received(:error).with("UpdateTicketStatus error: Update error")
      end
    end
  end

  describe "#call" do
    context "when all steps succeed" do
      it "creates a new ticket response" do
        expect {
          operation.call(valid_params)
        }.to change(Crm::TicketResponse, :count).by(1)
      end

      it "returns a successful result with the response" do
        result = operation.call(valid_params)
        expect(result).to be_success

        response = result.value!
        expect(response).to be_a(Crm::TicketResponse)
        expect(response.message).to eq("Admin response message")
        expect(response.responder_id).to eq(user.id)
        expect(response.response_type).to eq("admin_response")
      end

      it "updates the ticket status if it was open" do
        open_ticket = create(:crm_ticket, status: "open")
        params = valid_params.merge(ticket_id: open_ticket.id)

        expect {
          operation.call(params)
        }.to change { open_ticket.reload.status }.from("open").to("in_progress")
      end

      it "executes in a transaction" do
        expect(ActiveRecord::Base).to receive(:transaction).and_call_original
        operation.call(valid_params)
      end
    end

    context "when validation fails" do
      let(:invalid_params) { valid_params.merge(message: "") }

      it "does not create a ticket response" do
        expect {
          operation.call(invalid_params)
        }.not_to change(Crm::TicketResponse, :count)
      end

      it "returns a failure result" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
      end
    end

    context "when ticket is not found" do
      let(:invalid_params) { valid_params.merge(ticket_id: "non-existent") }

      it "does not create a ticket response" do
        expect {
          operation.call(invalid_params)
        }.not_to change(Crm::TicketResponse, :count)
      end

      it "returns a failure result" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to eq(["Ticket not found"])
      end
    end

    context "when response creation fails" do
      before do
        allow_any_instance_of(Crm::TicketResponse).to receive(:valid?).and_return(false)
        errors_double = instance_double(ActiveModel::Errors, full_messages: ["Invalid response"])
        allow_any_instance_of(Crm::TicketResponse).to receive(:errors).and_return(errors_double)
      end

      it "does not create a ticket response" do
        expect {
          operation.call(valid_params)
        }.not_to change(Crm::TicketResponse, :count)
      end

      it "returns a failure result" do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to eq(["Invalid response"])
      end
    end

    context "when ticket status update fails" do
      before do
        # Create a ticket that will fail validation when updated
        allow_any_instance_of(Crm::Ticket).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(ticket))
      end

      it "returns a failure result" do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end
    end
  end
end
