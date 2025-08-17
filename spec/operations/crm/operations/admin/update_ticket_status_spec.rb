# frozen_string_literal: true

require "rails_helper"

RSpec.describe Crm::Operations::Admin::UpdateTicketStatus do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:ticket) { create(:crm_ticket, status: "open", priority: "medium") }

  let(:valid_params) do
    {
      id: ticket.id,
      user_id: user.id,
      status: "in_progress",
      priority: "high"
    }
  end

  describe "#call" do
    context "when all params are valid" do
      it "returns a successful result" do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it "returns the updated ticket" do
        result = operation.call(valid_params)
        updated_ticket = result.value!
        expect(updated_ticket).to eq(ticket)
        expect(updated_ticket.status).to eq("in_progress")
        expect(updated_ticket.priority).to eq("high")
      end

      it "creates a system update response when status changes" do
        expect {
          operation.call(valid_params)
        }.to change(Crm::TicketResponse, :count).by(1)

        response = Crm::TicketResponse.last
        expect(response.response_type).to eq("system_update")
        expect(response.message).to include("Ticket status changed from 'Open' to 'In progress'")
        expect(response.responder_id).to eq(user.id)
      end
    end

    context "when only status is updated" do
      let(:status_only_params) do
        {
          id: ticket.id,
          user_id: user.id,
          status: "resolved"
        }
      end

      it "updates only the status" do
        result = operation.call(status_only_params)
        updated_ticket = result.value!
        expect(updated_ticket.status).to eq("resolved")
        expect(updated_ticket.priority).to eq("medium") # unchanged
      end
    end

    context "when only priority is updated" do
      let(:priority_only_params) do
        {
          id: ticket.id,
          user_id: user.id,
          priority: "urgent"
        }
      end

      it "updates only the priority" do
        result = operation.call(priority_only_params)
        updated_ticket = result.value!
        expect(updated_ticket.status).to eq("open") # unchanged
        expect(updated_ticket.priority).to eq("urgent")
      end

      it "does not create a system update response when status doesn't change" do
        expect {
          operation.call(priority_only_params)
        }.not_to change(Crm::TicketResponse, :count)
      end
    end

    context "when ticket is not found" do
      let(:invalid_params) do
        valid_params.merge(id: "non-existent-id")
      end

      it "returns a failure result" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(id: "Ticket not found")
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
      it "returns a failure result when id is missing" do
        invalid_params = valid_params.except(:id)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(id: ["is missing"])
      end

      it "returns a failure result when id is empty" do
        invalid_params = valid_params.merge(id: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(id: ["must be filled"])
      end

      it "returns a failure result when user_id is missing" do
        invalid_params = valid_params.except(:user_id)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end

      it "returns a failure result when status is invalid" do
        invalid_params = valid_params.merge(status: "invalid_status")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(status: ["must be one of: open, in_progress, resolved, dismissed"])
      end

      it "returns a failure result when priority is invalid" do
        invalid_params = valid_params.merge(priority: "invalid_priority")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(priority: ["must be one of: low, medium, high, urgent"])
      end
    end

    context "when optional params are not provided" do
      let(:minimal_params) do
        {
          id: ticket.id,
          user_id: user.id
        }
      end

      it "still validates successfully" do
        result = operation.send(:validate, minimal_params)
        expect(result).to be_success
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
        expect(result.failure).to include(id: "Ticket not found")
      end
    end
  end

  describe "#update_ticket" do
    let(:update_params) { { status: "resolved", priority: "high" } }

    context "when update is valid" do
      it "updates the ticket successfully" do
        result = operation.send(:update_ticket, ticket, update_params)
        expect(result).to be_success

        updated_ticket = result.value!
        expect(updated_ticket.status).to eq("resolved")
        expect(updated_ticket.priority).to eq("high")
      end

      it "persists the changes to the database" do
        operation.send(:update_ticket, ticket, update_params)
        ticket.reload
        expect(ticket.status).to eq("resolved")
        expect(ticket.priority).to eq("high")
      end
    end

    context "when update would make ticket invalid" do
      before do
        allow(ticket).to receive(:valid?).and_return(false)
        errors_double = instance_double(ActiveModel::Errors)
        allow(ticket).to receive(:errors).and_return(errors_double)
        allow(errors_double).to receive(:full_messages).and_return(["Validation error"])
      end

      it "returns a failure result" do
        result = operation.send(:update_ticket, ticket, update_params)
        expect(result).to be_failure
        expect(result.failure).to eq(["Validation error"])
      end
    end

    context "when a database error occurs" do
      before do
        allow(ticket).to receive(:save!).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:update_ticket, ticket, update_params)
        expect(result).to be_failure
        expect(result.failure).to eq(["Database error"])
        expect(Rails.logger).to have_received(:error).with("UpdateTicketStatus error: Database error")
      end
    end
  end

  describe "#create_system_update" do
    let(:old_status) { "open" }
    let(:params) { { user_id: user.id } }

    before do
      ticket.update!(status: "resolved")
    end

    context "when system update is valid" do
      it "creates a new ticket response" do
        expect {
          operation.send(:create_system_update, ticket, old_status, params)
        }.to change(Crm::TicketResponse, :count).by(1)
      end

      it "returns a successful result with the response" do
        result = operation.send(:create_system_update, ticket, old_status, params)
        expect(result).to be_success

        response = result.value!
        expect(response).to be_a(Crm::TicketResponse)
        expect(response.message).to eq("Ticket status changed from 'Open' to 'Resolved'")
        expect(response.responder_id).to eq(user.id)
        expect(response.response_type).to eq("system_update")
        expect(response.ticket).to eq(ticket)
      end
    end

    context "when an error occurs during save" do
      before do
        allow_any_instance_of(Crm::TicketResponse).to receive(:save!).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:create_system_update, ticket, old_status, params)
        expect(result).to be_failure
        expect(result.failure).to eq(["Database error"])
        expect(Rails.logger).to have_received(:error).with("CreateSystemUpdate error: Database error")
      end
    end
  end

  describe "#build_update_attributes" do
    it "returns only filled attributes" do
      params = { status: "resolved", priority: "high" }
      result = operation.send(:build_update_attributes, params)
      expect(result).to eq({ status: "resolved", priority: "high" })
    end

    it "filters out nil values" do
      params = { status: "resolved", priority: nil }
      result = operation.send(:build_update_attributes, params)
      expect(result).to eq({ status: "resolved" })
    end

    it "returns empty hash when no valid attributes" do
      params = { status: nil, priority: nil }
      result = operation.send(:build_update_attributes, params)
      expect(result).to eq({})
    end
  end
end
