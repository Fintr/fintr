# frozen_string_literal: true

require "rails_helper"

RSpec.describe Crm::Operations::CreateTicket do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }

  let(:valid_params) do
    {
      user_id: user.id,
      space_id: space.id,
      title: "Test ticket title",
      description: "Test ticket description",
      ticket_type: "general_feedback",
      priority: "medium"
    }
  end

  describe "#call" do
    context "when all params are valid" do
      it "returns a successful result" do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it "returns the created ticket" do
        result = operation.call(valid_params)
        ticket = result.value!
        expect(ticket).to be_a(Crm::Ticket)
        expect(ticket.title).to eq("Test ticket title")
        expect(ticket.description).to eq("Test ticket description")
        expect(ticket.ticket_type).to eq("general_feedback")
        expect(ticket.priority).to eq("medium")
        expect(ticket.status).to eq("open")
        expect(ticket.user_id).to eq(user.id)
        expect(ticket.space_id).to eq(space.id)
      end

      it "creates a new ticket" do
        expect {
          operation.call(valid_params)
        }.to change(Crm::Ticket, :count).by(1)
      end

      it "persists the ticket to the database" do
        result = operation.call(valid_params)
        ticket = result.value!
        expect(ticket).to be_persisted
      end
    end

    context "when priority is not provided" do
      let(:params_without_priority) do
        valid_params.except(:priority)
      end

      it "defaults priority to 'medium'" do
        result = operation.call(params_without_priority)
        ticket = result.value!
        expect(ticket.priority).to eq("medium")
      end
    end

    context "with images" do
      let(:valid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:params_with_images) do
        valid_params.merge(images: [valid_image])
      end

      it "attaches images to the ticket" do
        result = operation.call(params_with_images)
        ticket = result.value!
        expect(ticket.images).to be_attached
        expect(ticket.images.count).to eq(1)
      end
    end

    context "with invalid images" do
      let(:invalid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake content"),
          "text/plain",
          original_filename: "test_file.txt"
        )
      end
      let(:params_with_invalid_images) do
        valid_params.merge(images: [invalid_image])
      end

      it "filters out invalid images and still creates the ticket" do
        result = operation.call(params_with_invalid_images)
        expect(result).to be_success
        ticket = result.value!
        expect(ticket.images.count).to eq(0)
      end
    end

    context "with mixed valid and invalid images" do
      let(:valid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:invalid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake content"),
          "text/plain",
          original_filename: "test_file.txt"
        )
      end
      let(:params_with_mixed_images) do
        valid_params.merge(images: [valid_image, invalid_image, nil])
      end

      it "only attaches valid images" do
        result = operation.call(params_with_mixed_images)
        ticket = result.value!
        expect(ticket.images.count).to eq(1)
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

      it "returns a failure result when space_id is missing" do
        invalid_params = valid_params.except(:space_id)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["is missing"])
      end

      it "returns a failure result when space_id is empty" do
        invalid_params = valid_params.merge(space_id: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["must be filled"])
      end

      it "returns a failure result when title is missing" do
        invalid_params = valid_params.except(:title)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(title: ["is missing"])
      end

      it "returns a failure result when title is empty" do
        invalid_params = valid_params.merge(title: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(title: ["must be filled"])
      end

      it "returns a failure result when title is too long" do
        invalid_params = valid_params.merge(title: "a" * 256)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(title: ["must be at most 255 characters"])
      end

      it "returns a failure result when description is missing" do
        invalid_params = valid_params.except(:description)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(description: ["is missing"])
      end

      it "returns a failure result when description is empty" do
        invalid_params = valid_params.merge(description: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(description: ["must be filled"])
      end

      it "returns a failure result when description is too long" do
        invalid_params = valid_params.merge(description: "a" * 2001)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(description: ["must be at most 2000 characters"])
      end

      it "returns a failure result when ticket_type is missing" do
        invalid_params = valid_params.except(:ticket_type)
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_type: ["is missing"])
      end

      it "returns a failure result when ticket_type is empty" do
        invalid_params = valid_params.merge(ticket_type: "")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_type: ["must be filled"])
      end

      it "returns a failure result when ticket_type is invalid" do
        invalid_params = valid_params.merge(ticket_type: "invalid_type")
        result = operation.send(:validate, invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(ticket_type: ["must be one of: bug_report, feature_request, general_feedback, help_request, billing_issue, account_issue, other"])
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
          user_id: user.id,
          space_id: space.id,
          title: "Test title",
          description: "Test description",
          ticket_type: "general_feedback"
        }
      end

      it "still validates successfully" do
        result = operation.send(:validate, minimal_params)
        expect(result).to be_success
      end
    end

    context "when valid ticket types are provided" do
      %w[bug_report feature_request general_feedback help_request billing_issue account_issue other].each do |type|
        it "accepts #{type} as a valid ticket type" do
          params = valid_params.merge(ticket_type: type)
          result = operation.send(:validate, params)
          expect(result).to be_success
        end
      end
    end

    context "when valid priorities are provided" do
      %w[low medium high urgent].each do |priority|
        it "accepts #{priority} as a valid priority" do
          params = valid_params.merge(priority: priority)
          result = operation.send(:validate, params)
          expect(result).to be_success
        end
      end
    end
  end

  describe "#build_ticket" do
    context "when building ticket with all params" do
      it "builds a ticket with correct attributes" do
        result = operation.send(:build_ticket, valid_params)
        expect(result).to be_success

        ticket = result.value!
        expect(ticket).to be_a(Crm::Ticket)
        expect(ticket.title).to eq("Test ticket title")
        expect(ticket.description).to eq("Test ticket description")
        expect(ticket.ticket_type).to eq("general_feedback")
        expect(ticket.priority).to eq("medium")
        expect(ticket.status).to eq("open")
        expect(ticket.user_id).to eq(user.id)
        expect(ticket.space_id).to eq(space.id)
        expect(ticket).not_to be_persisted
      end
    end

    context "when building ticket without priority" do
      let(:params_without_priority) do
        valid_params.except(:priority)
      end

      it "defaults priority to 'medium'" do
        result = operation.send(:build_ticket, params_without_priority)
        ticket = result.value!
        expect(ticket.priority).to eq("medium")
      end
    end
  end

  describe "#attach_images" do
    let(:ticket) { build(:crm_ticket) }

    context "when images are valid" do
      let(:valid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:images) { [valid_image] }

      it "attaches valid images to the ticket" do
        result = operation.send(:attach_images, ticket, images)
        expect(result).to be_success
        expect(ticket.images).to be_attached
        expect(ticket.images.count).to eq(1)
      end
    end

    context "when images contain invalid files" do
      let(:valid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end
      let(:invalid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake content"),
          "text/plain",
          original_filename: "test_file.txt"
        )
      end
      let(:images) { [valid_image, invalid_image, nil] }

      it "only attaches valid images" do
        result = operation.send(:attach_images, ticket, images)
        expect(result).to be_success
        expect(ticket.images.count).to eq(1)
      end
    end

    context "when no valid images are provided" do
      let(:images) { [nil, ""] }

      it "does not attach any images" do
        result = operation.send(:attach_images, ticket, images)
        expect(result).to be_success
        expect(ticket.images.count).to eq(0)
      end
    end
  end

  describe "#save_ticket" do
    let(:ticket) { build(:crm_ticket) }

    context "when ticket is valid" do
      it "saves the ticket successfully" do
        result = operation.send(:save_ticket, ticket)
        expect(result).to be_success
        expect(result.value!).to eq(ticket)
        expect(ticket).to be_persisted
      end
    end

    context "when ticket is invalid" do
      before do
        allow(ticket).to receive(:valid?).and_return(false)
        errors_double = instance_double(ActiveModel::Errors)
        allow(ticket).to receive(:errors).and_return(errors_double)
        allow(errors_double).to receive(:full_messages).and_return(["Title can't be blank"])
      end

      it "returns a failure result with validation errors" do
        result = operation.send(:save_ticket, ticket)
        expect(result).to be_failure
        expect(result.failure).to eq(["Title can't be blank"])
      end
    end

    context "when a database error occurs" do
      before do
        allow(ticket).to receive(:save!).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:error)
      end

      it "logs the error and returns a failure" do
        result = operation.send(:save_ticket, ticket)
        expect(result).to be_failure
        expect(result.failure).to eq(["Database error"])
        expect(Rails.logger).to have_received(:error).with("CreateTicket error: Database error")
      end
    end
  end

  describe "#valid_image?" do
    context "when image has valid content type and size" do
      let(:valid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake image content"),
          "image/jpeg",
          original_filename: "test_image.jpg"
        )
      end

      it "returns true" do
        expect(operation.send(:valid_image?, valid_image)).to be true
      end
    end

    context "when image has invalid content type" do
      let(:invalid_image) do
        Rack::Test::UploadedFile.new(
          StringIO.new("fake content"),
          "text/plain",
          original_filename: "test_file.txt"
        )
      end

      it "returns false" do
        expect(operation.send(:valid_image?, invalid_image)).to be false
      end
    end

    context "when image is too large" do
      let(:large_image) do
        large_content = StringIO.new("x" * 11.megabytes)
        Rack::Test::UploadedFile.new(
          large_content,
          "image/jpeg",
          original_filename: "large_image.jpg"
        )
      end

      it "returns false" do
        expect(operation.send(:valid_image?, large_image)).to be false
      end
    end

    context "when image doesn't respond to content_type" do
      let(:invalid_object) { "not an image" }

      it "returns false" do
        expect(operation.send(:valid_image?, invalid_object)).to be false
      end
    end

    context "when testing all valid content types" do
      %w[image/jpeg image/png image/jpg image/gif image/webp].each do |content_type|
        it "accepts #{content_type} as valid" do
          image = Rack::Test::UploadedFile.new(
            StringIO.new("fake image content"),
            content_type,
            original_filename: "test_image.jpg"
          )
          expect(operation.send(:valid_image?, image)).to be true
        end
      end
    end
  end
end
